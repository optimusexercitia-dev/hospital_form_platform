-- =============================================================================
-- ADR 0094 W1 (Package A) — membership invariants + the replacement semantic.
--
-- Three things are under test, and they are deliberately tested at DIFFERENT layers
-- because each can hold at one layer while failing at another:
--
--   §1 CATALOG  — the constraints exist, in the shape claimed, and the trigger guards
--                 they replaced are GONE (never both enforcement paths).
--   §2 BASE TABLE — the invariant holds against raw DML, so it is a property of the
--                 data and not of any particular writer.
--   §3 DOOR     — public.grant_role implements the T1.0 replacement semantic, at the
--                 surface the product actually calls (authz-handoff §7.14: auditing
--                 one layer and inferring the next is how this program shipped bugs).
--
-- Every negative carries a POSITIVE twin. A constraint that rejects EVERYTHING passes
-- a deny-only suite perfectly (authz-handoff §7.1 / ADR 0079), and three of the
-- assertions here are about a composite FK, whose failure mode is exactly
-- "rejects more than it should".
--
-- Mutation-checked by supabase/tests/mutation/w1-membership-mutation-audit.sh —
-- each keystone below is proven to go RED when its constraint is dropped or its arm
-- neutralized.
-- =============================================================================

begin;
-- 10 catalog + 5 base-table + 6 composite-FK + 14 door = 35.
select plan(35);

update app.feature_flags set enabled = true where key in ('audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,  (v->>'sa_x')::uuid  as sa_x,
         (v->>'st_x')::uuid   as st_x,   (v->>'st_x2')::uuid as st_x2,
         (v->>'comm_x')::uuid as comm_x, (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,  (v->>'hosp_b')::uuid as hosp_b,
         -- ADR 0167: §4's door calls need an actor the commission tier still
         -- admits. `oa_b` is the bootstrap's org_admin of `org_b`, which owns
         -- comm_x — so `app.is_tenancy_admin_of_for(comm_x, oa_b)` is true
         -- through its ORG leg, with no commission membership at all.
         (v->>'oa_b')::uuid   as oa_b
  from ctx;
grant select on k to authenticated;

-- =============================================================================
-- §1 — CATALOG CENSUS (T1.1 / T1.4 / T1.5)
-- =============================================================================

select is(
  (select indexdef from pg_indexes
    where schemaname='public' and indexname='memberships_one_commission_role_uq'),
  'CREATE UNIQUE INDEX memberships_one_commission_role_uq ON public.memberships USING btree (principal_id, commission_id) WHERE (commission_id IS NOT NULL)',
  '1.1 T1.1: the one-role-per-commission index exists, UNIQUE and PARTIAL');

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid='public.memberships'::regclass and conname='memberships_hospital_id_fkey'),
  'FOREIGN KEY (hospital_id, organization_id) REFERENCES hospitals(id, organization_id) ON DELETE CASCADE',
  '1.2 T1.4: hospital/org integrity is a COMPOSITE FK, ON DELETE CASCADE preserved');

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid='public.memberships'::regclass and conname='memberships_title_id_fkey'),
  'FOREIGN KEY (title_id, commission_id) REFERENCES commission_member_titles(id, commission_id) ON DELETE SET NULL (title_id)',
  '1.3 T1.4: title/commission integrity is a COMPOSITE FK with a COLUMN-RESTRICTED set null');

-- The column list on SET NULL is not cosmetic: a bare `on delete set null` nulls
-- commission_id too, which memberships_scope_shape rejects, making commission titles
-- undeletable. §4 proves the behaviour; this pins the mechanism.
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid='public.memberships'::regclass and conname='memberships_title_id_fkey')
   like '%SET NULL (title_id)%',
  '1.4 T1.4: the SET NULL column list is present (a bare SET NULL would break title deletion)');

select is(
  (select count(*)::int from pg_trigger t
    where t.tgrelid='public.memberships'::regclass and not t.tgisinternal
      and t.tgname in ('guard_membership_hospital_org_trg','guard_membership_title_commission_trg')),
  0,
  '1.5 T1.4: both BEFORE-row trigger guards are RETIRED (never two enforcement paths)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname in ('guard_membership_hospital_org','guard_membership_title_commission')),
  0,
  '1.6 T1.4: the retired guard functions are dropped, not left orphaned in the catalog');

-- The audit trigger must SURVIVE the guard retirement (Rule 11). A migration that
-- dropped triggers by table rather than by name would take this with it.
select is(
  (select count(*)::int from pg_trigger
    where tgrelid='public.memberships'::regclass and tgname='trg_audit_memberships'),
  1,
  '1.7 POSITIVE TWIN: trg_audit_memberships survived the guard retirement');

select is(
  (select count(*)::int from pg_indexes
    where schemaname='public' and tablename='memberships' and indexname='memberships_granted_by_idx'),
  1,
  '1.8 T1.5: granted_by is indexed');

-- PGRST201 guard. Adding rather than replacing the FKs would make these 2, and the
-- un-hinted embeds in session.ts / members.ts / meetings.ts would 500 at runtime.
-- 186_member_titles §4a pins the titles side; this pins the hospitals side too.
select is(
  (select count(*)::int from pg_constraint
    where conrelid='public.memberships'::regclass and contype='f'
      and confrelid='public.hospitals'::regclass),
  1,
  '1.9 T1.4: exactly ONE memberships->hospitals FK (an un-hinted embed must stay unambiguous)');

-- MATCH SIMPLE soundness. The composite FKs are satisfied trivially whenever a
-- referencing column is NULL, so (hospital_id set, organization_id NULL) would slip
-- past the FK. It is unreachable ONLY because the shape CHECK forbids it. That makes
-- the CHECK load-bearing for the FK, which is not obvious from either constraint
-- alone — so it is pinned here rather than left as a migration comment.
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid='public.memberships'::regclass and conname='memberships_scope_shape') is not null,
  '1.10 T1.4: memberships_scope_shape survives — it is what makes the FKs'' MATCH SIMPLE sound');

-- =============================================================================
-- §2 — THE INVARIANT AT THE BASE TABLE (raw DML, no door)
-- =============================================================================

-- Direct DML denial: `authenticated` may only read. If this ever regains write
-- privileges, every door-level guarantee in W1/W3 is bypassable.
select is(
  (select count(*)::int from unnest(array['INSERT','UPDATE','DELETE']) as p(priv)
    where has_table_privilege('authenticated','public.memberships', p.priv)),
  0,
  '2.1 authenticated holds NO INSERT/UPDATE/DELETE on memberships');

select ok(
  has_table_privilege('authenticated','public.memberships','SELECT'),
  '2.2 POSITIVE TWIN: authenticated still holds SELECT (the probe can tell privileges apart)');

-- Dual-role denial. st_x is already `staff` of comm_x; a second row in ANY other role
-- must fail. This is the M2 defect, at the table.
select throws_ok(
  format($$insert into public.memberships (principal_id, commission_id, role)
           values (%L, %L, 'staff_admin')$$,
         (select st_x from k), (select comm_x from k)),
  '23505', null,
  '2.3 T1.1: a principal cannot hold a SECOND role in the same commission');

-- POSITIVE TWIN: the index must not forbid the same principal in a DIFFERENT
-- commission. A unique index accidentally written on (principal_id) alone would pass
-- 2.3 and fail here.
select lives_ok(
  format($$insert into public.memberships (principal_id, commission_id, role)
           values (%L, %L, 'staff')$$,
         (select st_x from k), (select comm_y from k)),
  '2.4 POSITIVE TWIN: the same principal MAY hold a role in a different commission');

-- POSITIVE TWIN: the org tier is deliberately outside the partial index.
select lives_ok(
  format($$insert into public.memberships (principal_id, organization_id, role) values
           (%L, %L, 'org_admin'), (%L, %L, 'nsp_org_admin')$$,
         (select st_x2 from k), (select org_b from k),
         (select st_x2 from k), (select org_b from k)),
  '2.5 POSITIVE TWIN: org-tier rows are unconstrained (org_admin + nsp_org_admin coexist)');

-- =============================================================================
-- §3 — COMPOSITE FK INTEGRITY (replaces the retired trigger guards)
-- =============================================================================

-- A genuinely foreign organization, MADE not borrowed. test_helpers.bootstrap()
-- TRUNCATEs the seed, so `select id from organizations where id <> org_b` returns
-- NULL here — which would make the insert below fail the shape CHECK (23514) for a
-- null organization_id and "pass" a 23503 expectation for entirely the wrong reason.
do $$
declare v_org_f uuid;
begin
  insert into public.organizations (id, name, slug)
  values (gen_random_uuid(), 'Org Estrangeira 291', 'org-f-291') returning id into v_org_f;
  perform set_config('t291.org_f', v_org_f::text, true);
end $$;

-- Cross-org hospital: hosp_b belongs to org_b, so pairing it with a foreign org must
-- fail — the guard_membership_hospital_org invariant, now relational (23503 not 23514).
select throws_ok(
  format($$insert into public.memberships (principal_id, organization_id, hospital_id, role)
           values (%L, %L, %L, 'hospital_admin')$$,
         (select st_x from k), current_setting('t291.org_f'), (select hosp_b from k)),
  '23503', null,
  '3.1 T1.4: a hospital paired with a FOREIGN organization is rejected by the FK');

select lives_ok(
  format($$insert into public.memberships (principal_id, organization_id, hospital_id, role)
           values (%L, %L, %L, 'hospital_admin')$$,
         (select st_x from k), (select org_b from k), (select hosp_b from k)),
  '3.2 POSITIVE TWIN: the hospital''s OWN organization is accepted');

-- Cross-commission title: a comm_y title on a comm_x membership must fail.
-- app.seed_member_titles_on_commission_insert already gives every commission its five
-- default titles, so these are selected rather than created (creating 'Presidente'
-- here collides with commission_member_titles_commission_name_key).
do $$
begin
  perform set_config('t291.title_y',
    (select id::text from public.commission_member_titles
      where commission_id = (select comm_y from k) and name = 'Presidente'), true);
  perform set_config('t291.title_x',
    (select id::text from public.commission_member_titles
      where commission_id = (select comm_x from k) and name = 'Presidente'), true);
end $$;

select throws_ok(
  format($$update public.memberships set title_id = %L
            where principal_id = %L and commission_id = %L$$,
         current_setting('t291.title_y'), (select st_x from k), (select comm_x from k)),
  '23503', null,
  '3.3 T1.4: a title from ANOTHER commission is rejected by the FK');

select lives_ok(
  format($$update public.memberships set title_id = %L
            where principal_id = %L and commission_id = %L$$,
         current_setting('t291.title_x'), (select st_x from k), (select comm_x from k)),
  '3.4 POSITIVE TWIN: the membership''s OWN commission title is accepted');

-- ON DELETE SET NULL (title_id): deleting the title clears title_id and LEAVES the
-- membership intact. With a bare `on delete set null` this delete raises 23514
-- instead, because commission_id would also be nulled.
select lives_ok(
  format($$delete from public.commission_member_titles where id = %L$$,
         current_setting('t291.title_x')),
  '3.5 T1.4: deleting an assigned title succeeds (column-restricted SET NULL)');

select is(
  (select commission_id from public.memberships
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k)),
  (select comm_x from k),
  '3.6 T1.4: ...and the membership KEEPS its commission_id (only title_id was nulled)');

-- =============================================================================
-- §4 — THE DOOR: T1.0 REPLACEMENT SEMANTIC (the surface the product calls)
-- =============================================================================

-- Re-title st_x so the promotion can be proven to PRESERVE the title.
-- 'Presidente' was deleted by 3.5; use another of the commission's seeded defaults.
do $$
declare v_title uuid;
begin
  select id into v_title from public.commission_member_titles
    where commission_id = (select comm_x from k) and name = 'Vice-Presidente';
  update public.memberships set title_id = v_title
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k);
  perform set_config('t291.title_p', v_title::text, true);
  perform set_config('t291.row_before',
    (select id::text from public.memberships
      where principal_id = (select st_x from k) and commission_id = (select comm_x from k)), true);
end $$;

-- The promotion itself, through the door, as a real principal.
--
-- ⚠ ACTOR CHANGED BY ADR 0167, AND THE CHANGE IS THE POINT OF THE RULING. This
--   section used the bootstrap PLATFORM ADMIN — the only org-less "can do
--   anything" principal the hermetic fixture has, which is why suites reached for
--   it. ADR 0167 dropped `app.is_admin_for` from `grant_role_impl`'s commission
--   `staff_admin` arm AND from its outgoing-role guard, so a platform admin can no
--   longer seat or re-role a commission coordinator. The dependency was FIXTURE
--   ERGONOMICS, not a product capability: nothing in `src/`, `e2e/`, `seed.sql` or
--   `demo/` relied on it. `oa_b` (org_admin of the org that owns comm_x) is the
--   authority the T1.0 semantic was always about. ⛔ Do NOT restore the platform
--   admin here to make a future red go away — pgTAP 397 § 2.1 asserts the refusal.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff_admin', %L)$$,
         (select comm_x from k), (select st_x from k)),
  '4.1 T1.0: granting the OTHER commission role succeeds (no unhandled 23505 escapes)');
reset role;

select is(
  (select role from public.memberships
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k)),
  'staff_admin',
  '4.2 T1.0: the role was REPLACED');

select is(
  (select count(*)::int from public.memberships
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k)),
  1,
  '4.3 T1.0: exactly ONE row remains (replacement, not accumulation)');

-- Identity + title preserved. These are what a delete+insert implementation destroys,
-- and they are the reason grant_role does an in-place UPDATE.
select is(
  (select id::text from public.memberships
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k)),
  current_setting('t291.row_before'),
  '4.4 T1.0: the membership row IDENTITY is preserved (audit entity_id stays valid)');

select is(
  (select title_id::text from public.memberships
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k)),
  current_setting('t291.title_p'),
  '4.5 T1.0: the member''s per-commission TITLE survives the role change');

-- Audit semantic: ONE role_changed event, not a revoked/granted pair. This is the
-- assertion that makes the UPDATE-vs-delete+insert choice observable.
select is(
  (select count(*)::int from public.audit_log
    where entity_type='membership' and action='membership.role_changed'
      and entity_id = current_setting('t291.row_before')::uuid),
  1,
  '4.6 T1.0: the replacement emits exactly one membership.role_changed audit event');

select is(
  (select count(*)::int from public.audit_log
    where entity_type='membership' and action in ('membership.revoked')
      and entity_id = current_setting('t291.row_before')::uuid),
  0,
  '4.7 T1.0: ...and NO membership.revoked (a delete+insert implementation would emit one)');

-- Idempotence: re-granting the role already held is a no-op, not a second event.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff_admin', %L)$$,
         (select comm_x from k), (select st_x from k)),
  '4.8 T1.0: re-granting the SAME role is idempotent');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where entity_type='membership' and action='membership.role_changed'
      and entity_id = current_setting('t291.row_before')::uuid),
  1,
  '4.9 T1.0: the idempotent re-grant emitted no additional role_changed event');

-- ── Authority over the OUTGOING role ────────────────────────────────────────
-- The hole the replacement semantic opens if written naively: grant_role's 'staff'
-- arm admits a plain is_staff_admin_of. Without an outgoing-role check, sa_x (a plain
-- staff_admin, whom the 'staff_admin' arm deliberately excludes) could DEMOTE a peer
-- staff_admin by "granting" them 'staff'. st_x is now staff_admin of comm_x.
--
-- ⭐ THE MESSAGE ARGUMENT WAS ADDED BY ADR 0167 AMENDMENT 2, AND IT IS NOT
--    DECORATION. Amendment 2 narrowed the 'staff' sub-arm, and the class that
--    still reaches the T1.0 outgoing-role guard — ADR 0167 clause 1's "site (b)"
--    — collapsed to exactly `is_staff_admin_of_for AND NOT is_tenancy_admin_of_for`.
--    sa_x IS that class, and with `null` here this cell was the only assertion in
--    the repository on that path while proving nothing about WHICH statement
--    refused: the sub-arm in front of site (b) raises the generic
--    'sem permissão' with the identical 42501. Site (b)'s own message is what
--    separates them. 397 § 5.3 carries the other half of the witness (an actor
--    who is ALSO `is_admin_for`, the only one for whom site (b) DECIDES).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$select public.grant_role('commission', %L, 'staff', %L)$$,
         (select comm_x from k), (select st_x from k)),
  '42501', 'sem permissão para alterar a função de um administrador da comissão',
  '4.10 T1.0: a plain staff_admin CANNOT demote a peer staff_admin (role-pin is symmetric) — and is refused BY THE OUTGOING-ROLE GUARD, asserted by message, not by the authority arm one statement earlier');
reset role;

select is(
  (select role from public.memberships
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k)),
  'staff_admin',
  '4.11 T1.0: ...and the target actually kept the role (the deny was not merely an error)');

-- POSITIVE TWIN for 4.10: the same actor CAN still add a plain staff member. Without
-- this, an arm that rejected every staff grant would pass 4.10.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff', %L)$$,
         (select comm_x from k), (select st_x2 from k)),
  '4.12 POSITIVE TWIN: a plain staff_admin can still grant plain staff');
reset role;

-- A commission-admin (here: the ORG_ADMIN of the owning org) MAY perform the
-- demotion the staff_admin cannot.
--
-- ⭐ THIS IS THE CELL ADR 0167 WOULD HAVE MADE VACUOUS RATHER THAN RED, AND THAT
--    IS WHY IT IS CALLED OUT. With the platform admin as actor, 4.1 above would
--    have been refused, `st_x` would still be plain `staff`, and "an authorized
--    admin CAN demote" would degrade into a demotion to the role the target
--    already held — a no-op that passes. The assertion would have sat in the
--    green column while asserting nothing. `291:353` was, measured, the ONLY site
--    in the repository where a platform admin demoted a commission `staff_admin`.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff', %L)$$,
         (select comm_x from k), (select st_x from k)),
  '4.13 POSITIVE TWIN: an authorized admin CAN demote (the outgoing-role check is authority-based, not a blanket ban)');
reset role;

select is(
  (select role from public.memberships
    where principal_id = (select st_x from k) and commission_id = (select comm_x from k)),
  'staff',
  '4.14 T1.0: the authorized demotion landed');

select * from finish();
rollback;
