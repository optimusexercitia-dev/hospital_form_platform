-- 403 — AE4.5: the differential oracle.
-- Subjects: authz.has_direct_permission (AE4.4b) vs the legacy evaluators, over the
-- PO-approved matrix (docs/design/authz-ae43-staff-admin-permission-matrix.md, 42 rows) and the
-- PO-approved deny-class effect table (docs/design/authz-ae45-deny-class-effects.md, 9 rows).
--
-- ⛔ TWO ASSERTIONS PER CELL, AND THE SECOND IS THE POINT.
--   §4  is(legacy, catalog)          — the resolver reproduces today's behaviour;
--   §5  is(catalog, approved-value)  — the MATRIX is the oracle, not "whatever legacy did".
-- With only the first, the cheapest green is to approve a legacy defect into the oracle.
--
-- ⛔ THE EXPECTED VALUES ARE NOT COMPUTED THE WAY THE RESOLVER COMPUTES THEM. They are
-- transcribed from two hand-encoded sources (the matrix row; the deny-class table) into the
-- generated vector file, which performs no scope-reaching join, no closure lookup and no
-- role_permissions read. A suite whose expected values mirror the implementation proves only
-- that the resolver equals a second copy of itself.
--
-- ⚠ TWO APPROVED LIMITATIONS — they are not caveats to drop, and the gate record must carry them:
--   * `suspended` is NOT independently observable — app.is_active folds it with `inactive`, so no
--     site distinguishes them. Any claim of separate suspension coverage is false.
--   * `cross_org` asserts the REQUIRED answer; matrix §6.1 measured that it is enforced by the
--     UUID id-space, not by any org term in the resolver. ⛔ This must never read as
--     "the resolver enforces tenant isolation".
--
-- ⚠ PER-PERMISSION GRAIN: the axis sweep runs one representative per legacy-equivalence class
-- (three; pgTAP 401 §19.2 asserts the partition). Per-permission GRANT is covered by 401 §19.4's
-- 42 cheap probes. Per-permission AXES are not observable until AE5 gives a role a partial map.
--
-- RUN SHAPE: `Files=2, Tests=13` (12 here + 00_setup.sql's one).

begin;
select plan(12);

\ir vectors/authz_differential_cells.psql

-- ============================================================================
-- §1 — the fixture. Three holding scopes, one of them CONSTRUCTED cross-org.
-- ⛔ Deleted BY IDENTITY at the end, never positionally — a positional cleanup eats seed rows
-- that ~900 tests contractually depend on.
-- ============================================================================

create temp table f403 on commit drop as
select
  (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')            as uid,
  (select m.commission_id from public.memberships m join public.profiles p on p.id = m.principal_id
    where p.email = 'chefe.ccih@test.local' and m.role = 'staff_admin' limit 1)           as own_cid,
  '00000000-0000-4403-8000-000000000001'::uuid                                            as sib_holder,
  '00000000-0000-4403-8000-000000000002'::uuid                                            as xorg_holder,
  '00000000-0000-4403-8000-000000000003'::uuid                                            as nobody;

alter table f403 add column sib_cid uuid;
alter table f403 add column xorg_cid uuid;
alter table f403 add column own_oid uuid;
alter table f403 add column xorg_oid uuid;

update f403 set
  own_oid  = (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where c.id = own_cid),
  sib_cid  = (select c.id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where h.organization_id = (select h2.organization_id from public.commissions c2
                                            join public.hospitals h2 on h2.id = c2.hospital_id where c2.id = own_cid)
                 and c.id <> own_cid limit 1);
update f403 set
  xorg_cid = (select c.id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where h.organization_id <> own_oid limit 1);
update f403 set
  xorg_oid = (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where c.id = xorg_cid);

-- ⚠ profiles.id references auth.users, so the auth rows come first (the shape 00_setup.sql
-- uses). A handle_new_user trigger may already materialise the profile, hence the upsert.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid, sib_holder,  'authenticated','authenticated','zz403.sib@test.local',  now(), now() from f403 union all
select '00000000-0000-0000-0000-000000000000'::uuid, xorg_holder, 'authenticated','authenticated','zz403.xorg@test.local', now(), now() from f403 union all
select '00000000-0000-0000-0000-000000000000'::uuid, nobody,      'authenticated','authenticated','zz403.nobody@test.local',now(), now() from f403;

insert into public.profiles (id, email, full_name, is_active, email_confirmed_at)
select sib_holder,  'zz403.sib@test.local',  'ZZ403 Sibling',   true, now() from f403 union all
select xorg_holder, 'zz403.xorg@test.local', 'ZZ403 CrossOrg',  true, now() from f403 union all
select nobody,      'zz403.nobody@test.local','ZZ403 Nobody',   true, now() from f403
on conflict (id) do update set is_active = true, email_confirmed_at = now();

insert into public.memberships (principal_id, commission_id, role)
select sib_holder,  sib_cid,  'staff_admin' from f403 union all
select xorg_holder, xorg_cid, 'staff_admin' from f403;

select ok((select xorg_cid from f403) is not null and (select sib_cid from f403) is not null
          and (select xorg_oid from f403) <> (select own_oid from f403),
  '1.1 FIXTURE CONTROL: a sibling commission (same org) and a CONSTRUCTED cross-org holder in a '
  'DIFFERENT organization both resolve. ⛔ No seeded persona holds anything outside its home org, '
  'so the cross-org half of this matrix is fixture-only by construction — a cross-org cell written '
  'against a seeded persona passes while proving nothing.');

-- ============================================================================
-- §2 — the cell set, and its controls.
-- ============================================================================

select cmp_ok((select count(*)::int from authz_differential_cells), '>', 800,
  '2.1 CARDINALITY CONTROL: the generated cell set is populated. An empty or truncated vector '
  'file would let §§4-5 iterate nothing and pass having asserted nothing.');

select ok(
  (select count(*) from authz_differential_cells where expected_granted) > 0
  and (select count(*) from authz_differential_cells where not expected_granted) > 0,
  '2.2 ⭐ the EXPECTED column carries BOTH answers. A cell set expecting only denials would be '
  'satisfied by a resolver stuck at false, which is the single most likely way this suite could '
  'pass while proving nothing.');

select is((select count(distinct legacy_class)::int from authz_differential_cells), 3,
  '2.3 all THREE legacy-equivalence classes are swept (401 §19.2 asserts the partition is total '
  'and that there are exactly three).');

select ok(
  (select count(*) from authz_differential_cells where self_check) > 0
  and (select count(*) from authz_differential_cells where not self_check) > 0,
  '2.4 ⭐⭐ §6A BOTH POLARITIES ARE PRESENT — self-check AND third-party. ⛔ A generator emitting '
  'only the self-check passes while pinning the uniform-apply bug, which would break all 27 `_for` '
  'call sites. This is the arm that makes the omission impossible.');

select ok(
  (select count(*) from authz_differential_cells
    where resolution_scope_kind = 'organization' and scope = 'sibling_commission'
      and expected_granted) > 0,
  '2.5 ⭐ §11.3 THE DIFFERING-SCOPE CELL EXISTS AND EXPECTS A GRANT: an ORG-scoped permission IS '
  'reached from a SIBLING commission (the ascent), where a commission-scoped one is not. Without '
  'this cell the whole org-scoped class goes untested and an adapter deriving resolution scope '
  'from allowed_scope_kind would look correct.');

-- ============================================================================
-- §3 — the driver. Materialises each cell's state and calls BOTH evaluators.
-- ============================================================================

create or replace function pg_temp.cell_answers(
  p_persona text, p_ctx text, p_scope text, p_code text, p_class text, p_state text, p_self boolean
) returns table (legacy boolean, catalog boolean)
language plpgsql volatile as $d$
declare
  f record; v_principal uuid; v_scope_id uuid; v_res text;
begin
  -- ⛔ RESET CLAIMS FIRST. guard_profile_privileged_columns refuses lifecycle writes unless the
  -- caller is service-role, and the PREVIOUS cell's claims_for() left `authenticated` in place —
  -- so without this the second cell onward fails with "identity/lifecycle columns are
  -- service-role-only". The failure is in the DRIVER, not the subject.
  perform test_helpers.reset_role_and_claims();
  select * into f from f403;
  v_principal := case p_persona
      when 'subject_holder' then f.uid
      when 'other_commission_holder' then f.sib_holder
      when 'cross_org_actor' then f.xorg_holder
      else f.nobody end;

  select pm.resolution_scope_kind::text into v_res from authz.permissions pm where pm.code = p_code;

  if v_res = 'commission' then
    v_scope_id := case p_scope when 'own_commission' then f.own_cid
                               when 'sibling_commission' then f.sib_cid
                               else f.xorg_cid end;
  else
    v_scope_id := case p_scope when 'foreign_org_commission' then f.xorg_oid else f.own_oid end;
  end if;

  -- principal state (the deny-class axis). `pending` sets ONLY the profiles mirror, which is
  -- what the seed models and what app.is_active does NOT read — deny-class table row 5.
  update public.profiles set is_active = true, suspended_until = null, email_confirmed_at = now()
   where id = v_principal;
  if p_state = 'deactivated' then update public.profiles set is_active = false where id = v_principal;
  elsif p_state = 'suspended' then update public.profiles set suspended_until = now() + interval '7 days' where id = v_principal;
  elsif p_state = 'pending' then update public.profiles set email_confirmed_at = null where id = v_principal;
  end if;

  -- active-role context; only meaningful for a self-check (§6A).
  if p_self then
    perform test_helpers.claims_for(v_principal, false,
      case p_ctx when 'matching' then 'staff_admin' when 'other_role' then 'quality_reviewer' else null end);
  else
    perform test_helpers.claims_for(f.uid, false, 'quality_reviewer');
  end if;

  legacy := case p_class
    when 'is_staff_admin_of_for'         then app.is_staff_admin_of_for(v_scope_id, v_principal)
    when 'can_manage_professional'       then app.can_manage_professional(v_scope_id, v_principal)
    else app.can_manage_professional(v_scope_id, v_principal)   -- row 33 delegates to it
  end;
  catalog := authz.has_direct_permission(v_principal, v_res, v_scope_id, p_code);
  return next;
end $d$;

create temp table r403 on commit drop as
select c.*, a.legacy, a.catalog
  from authz_differential_cells c
  cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                          c.permission_code, c.legacy_class,
                                          c.principal_state, c.self_check) a;

select test_helpers.reset_role_and_claims();

select is((select count(*)::int from r403 where legacy is null or catalog is null), 0,
  '3.1 the driver returned an answer for EVERY cell — a NULL would fall out of the comparisons '
  'below and read as agreement.');

select ok(
  (select count(*) from r403 where catalog) > 0 and (select count(*) from r403 where not catalog) > 0,
  '3.2 ⭐ DISCRIMINATION CONTROL: the resolver returned BOTH answers across the sweep. A resolver '
  'stuck on one value could satisfy a same-answer cell set, and this is what stops that reading as '
  'agreement.');

-- ============================================================================
-- §4 — is(legacy, catalog).
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' catalog=' || catalog::text,
                              ' | ' order by cell_id), '(none)')
     from r403 where legacy is distinct from catalog),
  '(none)',
  '4.1 ⭐ LEGACY == CATALOG on every cell. ⛔ Because the matrix is ALREADY APPROVED, a difference '
  'here means legacy is wrong or the resolver is wrong — it is never a licence to record "the '
  'catalog matches legacy" and move on (PA-F8). The message names the disagreeing cells.');

-- ============================================================================
-- §5 — is(catalog, approved matrix value). THE ORACLE HALF.
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' catalog=' || catalog::text || ' expected=' ||
                              expected_granted::text || ' src=' || expected_source,
                              ' | ' order by cell_id), '(none)')
     from r403 where catalog is distinct from expected_granted),
  '(none)',
  '5.1 ⭐⭐ CATALOG == THE APPROVED VALUE. This is what makes the MATRIX the oracle rather than '
  '"whatever legacy did" — with §4 alone, the cheapest green is to approve a legacy defect into '
  'the regression oracle. Expected values come from the approved matrix row and the approved '
  'deny-class table ONLY, never from resolver logic. '
  '⚠ ROW 7 WILL LOOK LIKE A BUG AND IS NOT: a THIRD-PARTY check carrying the WRONG HAT is '
  'GRANTED, because app.has_role''s active-context term is '
  '`(p_user_id is distinct from auth.uid() or ...)` — it short-circuits entirely when the '
  'principal is not the caller. ⛔ Do not "fix" that. Both polarities are required precisely '
  'because a suite emitting only the self-check passes while pinning the uniform-apply bug.');

select is(
  (select count(*)::int from r403 where expected_source like 'deny-class:wrong_active_context:third-party%'
     and not catalog),
  0,
  '5.2 ⭐ §6A''s asymmetry, asserted head-on: every WRONG-HAT THIRD-PARTY cell is GRANTED. If this '
  'reds, the adapter has started applying the active-role filter uniformly, which breaks all 27 '
  '`_for` call sites while looking like a tightening.');

-- ⛔ Cleanup BY IDENTITY, never positionally.
delete from public.memberships where principal_id in
  (select sib_holder from f403 union all select xorg_holder from f403);
-- ⚠ `profiles` are never deleted (a guard enforces it — deactivate via is_active). Removing the
-- auth.users row is the by-identity route, and the profile follows it.
delete from auth.users where id in
  (select sib_holder from f403 union all select xorg_holder from f403 union all select nobody from f403);

select * from finish();
rollback;
