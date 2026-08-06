-- =============================================================================
-- ADR 0094 W3 (Package B) — the actor kernel and the service door.
--
-- W3 claims to be a MECHANISM SWAP: the same authority arms, reached two ways. A
-- claim like that fails in exactly one direction — the new entry point being subtly
-- more permissive than the old — and no amount of "the code looks the same" detects
-- it, because the two paths resolve the actor differently by construction.
--
-- So §2 is an EQUIVALENCE GRID: every (scope, role, actor) cell is driven through
-- BOTH entry points and the verdicts must match cell for cell. §3 then pins the two
-- deliberate NARROWINGS on the service path (self-grant, anti-lockout), which the
-- grid alone would report as "equivalent" only because both paths now deny.
--
-- §1 is the ACL, and it is the most important single assertion in this file: if
-- `authenticated` ever holds EXECUTE on `grant_role_for`, any signed-in user can name
-- an arbitrary actor and inherit that actor's authority. That is a total
-- authorization bypass, and it is one GRANT away at all times.
-- =============================================================================

begin;
-- 7 ACL/structure + 8 equivalence grid + 6 narrowings + 3 service-door reachability = 24.
select plan(25);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,  (v->>'sa_x')::uuid  as sa_x,
         (v->>'st_x')::uuid   as st_x,   (v->>'st_x2')::uuid as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x, (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,  (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- =============================================================================
-- §1 — THE SURFACE AND ITS ACLs
-- =============================================================================

select is(
  (select count(*)::int from unnest(array['authenticated','anon','public']) as r(who)
    where has_function_privilege(r.who, 'public.grant_role_for(uuid,text,uuid,text,uuid,uuid)', 'EXECUTE')),
  0,
  '1.1 grant_role_for: NO EXECUTE for authenticated/anon/PUBLIC (naming an actor must be service-only)');

select is(
  (select count(*)::int from unnest(array['authenticated','anon','public']) as r(who)
    where has_function_privilege(r.who, 'public.revoke_role_for(uuid,text,uuid,text,uuid)', 'EXECUTE')),
  0,
  '1.2 revoke_role_for: NO EXECUTE for authenticated/anon/PUBLIC');

select ok(
  has_function_privilege('service_role', 'public.grant_role_for(uuid,text,uuid,text,uuid,uuid)', 'EXECUTE'),
  '1.3 POSITIVE TWIN: service_role DOES hold EXECUTE (the probe distinguishes roles)');

-- The kernels are internal: not even service_role calls them directly, so a future
-- caller cannot skip the wrappers and, with them, the ACL boundary.
select is(
  (select count(*)::int from unnest(array['authenticated','anon','public','service_role']) as r(who)
    where has_function_privilege(r.who, 'app.grant_role_impl(uuid,text,uuid,text,uuid,uuid)', 'EXECUTE')),
  0,
  '1.4 app.grant_role_impl is owner-only (the kernel is not a public entry point)');

-- The incumbent doors must still be reachable by ordinary users, or every
-- cookie-authenticated caller breaks.
select ok(
  has_function_privilege('authenticated', 'public.grant_role(text,uuid,text,uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.revoke_role(text,uuid,text,uuid)', 'EXECUTE'),
  '1.5 the session doors remain EXECUTE-able by authenticated');

-- Delegation, structurally: the public doors must carry no authority logic of their
-- own, or "written once" is false and the two paths can drift.
select ok(
  (select bool_and(p.prosrc ~ '(grant|revoke)_role_impl')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname in ('grant_role','revoke_role')),
  '1.6 public.grant_role/revoke_role delegate to the kernel');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname in ('grant_role','revoke_role')
      and p.prosrc ~ 'is_staff_admin_of|is_commission_admin_of|is_org_admin_of'),
  0,
  '1.7 ...and hold NO authority predicate of their own (one place to change an arm)');

-- =============================================================================
-- §2 — THE EQUIVALENCE GRID
-- =============================================================================
--
-- Each probe runs its call in a subtransaction and forces a rollback, so the grid is
-- non-destructive and cell order cannot matter. A permitted call is reported as
-- ALLOWED; a refused one reports its SQLSTATE, so "both denied" is only equivalent
-- when denied for the SAME REASON.
create or replace function app._t293_verdict(
  p_entry text, p_actor uuid, p_scope text, p_scope_id uuid, p_role text, p_user uuid)
returns text language plpgsql as $v$
declare v text;
begin
  begin
    if p_entry = 'session' then
      perform public.grant_role(p_scope, p_scope_id, p_role, p_user);
    else
      perform public.grant_role_for(p_actor, p_scope, p_scope_id, p_role, p_user);
    end if;
    raise exception 'T293_ALLOWED';
  exception when others then
    if sqlerrm = 'T293_ALLOWED' then v := 'ALLOWED'; else v := sqlstate; end if;
  end;
  return v;
end $v$;

create temp table cells (id int generated always as identity, actor uuid, actor_label text,
                         scope text, scope_id uuid, role text, target uuid) on commit drop;
insert into cells (actor, actor_label, scope, scope_id, role, target)
select a.actor, a.label, c.scope, c.scope_id, c.role, (select st_x2 from k)
from (values
        ((select admin from k), 'platform_admin'),
        ((select sa_x  from k), 'staff_admin(comm_x)'),
        ((select st_x  from k), 'plain staff(comm_x)'),
        ((select sa_y  from k), 'staff_admin(comm_y)')
     ) as a(actor, label),
     (values
        ('commission',   (select comm_x from k), 'staff'),
        ('commission',   (select comm_x from k), 'staff_admin'),
        ('organization', (select org_b  from k), 'org_admin')
     ) as c(scope, scope_id, role);
grant select on cells to authenticated;

create temp table verdicts (cell int, entry text, verdict text) on commit drop;
grant all on verdicts to authenticated;

-- Pass 1: the SESSION entry, once per actor (claims are per-session, so the actor
-- loop is on the outside).
do $$
declare r record;
begin
  for r in select distinct actor from cells loop
    perform test_helpers.claims_for(r.actor, r.actor = (select admin from k));
    insert into verdicts (cell, entry, verdict)
    select c.id, 'session',
           app._t293_verdict('session', c.actor, c.scope, c.scope_id, c.role, c.target)
    from cells c where c.actor = r.actor;
  end loop;
end $$;

-- Pass 2: the SERVICE entry. No claims are set at all — which is the point: the
-- service path must reach the same verdict with no session whatsoever.
select test_helpers.claims_for(null, false);
insert into verdicts (cell, entry, verdict)
select c.id, 'service',
       app._t293_verdict('service', c.actor, c.scope, c.scope_id, c.role, c.target)
from cells c;

select is(
  (select count(*)::int from verdicts v1 join verdicts v2
     on v1.cell = v2.cell and v1.entry='session' and v2.entry='service'
   where v1.verdict is distinct from v2.verdict),
  0,
  '2.1 EQUIVALENCE: every (scope, role, actor) cell reaches the SAME verdict through both entry points');

-- A grid where every cell denies would satisfy 2.1 vacuously. Both of these prove the
-- grid discriminates: it contains real ALLOWs and real DENYs, on both paths.
select ok(
  (select count(*) from verdicts where entry='service' and verdict='ALLOWED') > 0,
  '2.2 POSITIVE TWIN: the grid contains at least one ALLOWED cell on the service path');

select ok(
  (select count(*) from verdicts where entry='service' and verdict='42501') > 0,
  '2.3 POSITIVE TWIN: ...and at least one 42501 DENY (the grid is not all-permit either)');

select is(
  (select count(distinct verdict)::int from verdicts where entry='session'),
  (select count(distinct verdict)::int from verdicts where entry='service'),
  '2.4 both entry points produce the same SET of distinct outcomes');

-- Named cells, so a future reader sees the actual policy rather than only a diff.
select is(
  (select verdict from verdicts v join cells c on c.id = v.cell
    where v.entry='service' and c.actor_label='staff_admin(comm_x)' and c.role='staff_admin'),
  '42501',
  '2.5 ROLE-PIN survives the swap: a plain staff_admin cannot grant staff_admin (service path)');

select is(
  (select verdict from verdicts v join cells c on c.id = v.cell
    where v.entry='service' and c.actor_label='staff_admin(comm_x)' and c.role='staff'),
  'ALLOWED',
  '2.6 POSITIVE TWIN: ...but the same actor CAN grant plain staff');

select is(
  (select verdict from verdicts v join cells c on c.id = v.cell
    where v.entry='service' and c.actor_label='staff_admin(comm_y)' and c.role='staff'),
  '42501',
  '2.7 TENANCY: a staff_admin of ANOTHER commission is denied (the actor is re-validated, not trusted)');

select is(
  (select verdict from verdicts v join cells c on c.id = v.cell
    where v.entry='service' and c.actor_label='plain staff(comm_x)' and c.role='staff'),
  '42501',
  '2.8 a plain staff member cannot grant anything');

-- =============================================================================
-- §3 — THE TWO NARROWINGS THE SERVICE PATH GAINS
-- =============================================================================

-- Self-grant. Raw service-role DML never checked this; the kernel does, on both paths.
-- ⚠ app._deny_self_grant reads auth.uid(), so delegating to it would have been a
-- SILENT NO-OP on the service path (no session => auth.uid() is null => never equal).
-- The kernel inlines the comparison against p_actor instead; that is what this pins.
select test_helpers.claims_for(null, false);
select is(
  app._t293_verdict('service', (select admin from k), 'commission', (select comm_x from k),
                    'staff', (select admin from k)),
  '42501',
  '3.1 SELF-GRANT is denied on the SERVICE path (actor compared to p_actor, not auth.uid())');

select is(
  app._t293_verdict('service', (select admin from k), 'commission', (select comm_x from k),
                    'staff', (select st_x2 from k)),
  'ALLOWED',
  '3.2 POSITIVE TWIN: the same actor granting SOMEONE ELSE is allowed');

-- Anti-lockout, now binding on the service path. org_b has exactly one org_admin
-- after this grant, so revoking it must raise HC0G1.
-- ⚠ PRECONDITION, ASSERTED RATHER THAN INHERITED (AFF T3.5). This section reasons about
-- "the LAST org_admin", so it must CONTROL how many exist — and until T3.5 it merely
-- inherited "the bootstrap creates none". T3.5 added an org_admin to the shared
-- bootstrap (FUP-PCITV-1 row 6: without one, the ORG disjunct of
-- `is_commission_admin_of` was unexercised by six isolation keystones), and these
-- assertions went red — correctly. One fixture cannot satisfy both specs, so the spec
-- that OWNS the count normalizes it here, explicitly, instead of depending on a
-- fixture it does not control. Rolled back with the transaction like everything else.
-- Targets ONLY the bootstrap's own persona, by its key in the fixture's jsonb — not
-- "every org_admin of org_b", which also deleted the one this file builds for itself.
delete from public.memberships
 where role = 'org_admin' and commission_id is null and hospital_id is null
   and principal_id = (((select v from ctx)) ->> 'oa_b')::uuid;
select is(
  (select count(*)::int from public.memberships
    where organization_id = (select org_b from k) and role = 'org_admin'), 0,
  '3.2b org_admin precondition: org_b starts this section with ZERO org_admins');

select test_helpers.claims_for(null, false);
do $$
begin
  perform public.grant_role_for((select admin from k), 'organization', (select org_b from k),
                                'org_admin', (select st_x2 from k));
end $$;

select is(
  (select count(*)::int from public.memberships
    where organization_id = (select org_b from k) and role = 'org_admin'),
  1,
  '3.3 fixture: org_b now has exactly ONE org_admin');

select throws_ok(
  format($$select public.revoke_role_for(%L, 'organization', %L, 'org_admin', %L)$$,
         (select admin from k), (select org_b from k), (select st_x2 from k)),
  'HC0G1', null,
  '3.4 ANTI-LOCKOUT binds the SERVICE path: the org''s last org_admin cannot be revoked');

-- POSITIVE TWIN: with a second org_admin present, the revoke succeeds — so 3.4 is a
-- lockout guard, not a blanket refusal to revoke org_admin.
do $$
begin
  perform public.grant_role_for((select admin from k), 'organization', (select org_b from k),
                                'org_admin', (select st_x from k));
end $$;

select lives_ok(
  format($$select public.revoke_role_for(%L, 'organization', %L, 'org_admin', %L)$$,
         (select admin from k), (select org_b from k), (select st_x2 from k)),
  '3.5 POSITIVE TWIN: with a second org_admin present the revoke succeeds');

select is(
  (select count(*)::int from public.memberships
    where organization_id = (select org_b from k) and role = 'org_admin'),
  1,
  '3.6 ...and exactly one org_admin remains');

-- =============================================================================
-- §4 — THE SERVICE DOOR IS UNREACHABLE FROM A SESSION
-- =============================================================================
-- The ACL in §1 is the mechanism; this is the behaviour. A signed-in user calling
-- grant_role_for must fail at the privilege check (42501), never reach the kernel.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$select public.grant_role_for(%L, 'commission', %L, 'staff_admin', %L)$$,
         (select admin from k), (select comm_x from k), (select st_x from k)),
  '42501', null,
  '4.1 an authenticated user calling grant_role_for is refused (cannot borrow another actor''s authority)');

select throws_ok(
  format($$select public.revoke_role_for(%L, 'commission', %L, 'staff', %L)$$,
         (select admin from k), (select comm_x from k), (select st_x2 from k)),
  '42501', null,
  '4.2 ...and revoke_role_for likewise');

-- POSITIVE TWIN: the same user CAN reach the session door (proving 4.1/4.2 are about
-- the service door specifically, not a broken session).
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff', %L)$$,
         (select comm_x from k), (select st_x2 from k)),
  '4.3 POSITIVE TWIN: ...while the session door is reachable by the same caller');
reset role;

select * from finish();
rollback;
