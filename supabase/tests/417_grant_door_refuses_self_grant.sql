-- =============================================================================
-- GRANT-PLANE-CONVENTION-A1 — the case grant door refuses a SELF-GRANT.
-- ADR 0205 § Amendment 1, clause D6·5·1 (PO ruling, 2026-09-10).
--
-- WHAT THIS PROVES. `public.grant_case_access` never compared the grantee to
-- `auth.uid()`; its own comment named grantee membership as the anti-self-escalation
-- guard. The door now refuses `p_user = auth.uid()` outright, with a new SQLSTATE
-- `HC0U1`, placed immediately after the authority gate and the U1 exclusion and
-- BEFORE level, membership, expiry and the terminal check — so a self-grant is
-- refused as an ACT, not as a payload.
--
-- ⚠⚠ MEASURED BEFORE THIS FILE WAS WRITTEN, AND IT CORRECTS D6·5·1's PREMISE.
--    D6·5·1 names the TENANCY ADMIN who also holds a plain membership as the live
--    escalation. On the live catalog she is NOT reachable, for a reason the clause
--    does not mention: `app.has_role` / `app.has_role_any` carry the ACT hat conjunct
--    `p_user_id is distinct from auth.uid() or m.role is not distinct from
--    app.active_role()` (BUG-ACT-NULLHAT-1). Wearing `org_admin` she passes the
--    AUTHORITY arm and her own plain `staff` row is INVISIBLE, so the door answered
--    `HC021`; wearing `staff` she fails authority with `42501`. Both gates cannot pass
--    in one session. Probe, pre-migration, three arms:
--        hat=org_admin → is_tenancy_admin_of=t, self_is_member=f → HC021
--        hat=staff     → is_tenancy_admin_of=f, self_is_member=t → 42501
--        hat=(none)    → both false
--    ⭐ THE ARM THAT IS ACTUALLY LIVE IS THE COORDINATOR: hat=staff_admin gives
--    is_staff_admin_of=t AND self_is_member=t, and the self-grant SUCCEEDED, storing a
--    row stamped `coordinator_grant` — including, through the two SQL-only PHI
--    parameters, `read_restricted_phi`, which D5·6 explicitly lets a coordinator ISSUE
--    without holding. So the ruling's REMEDY is right and closes more than it claims;
--    only its account of which arm is open was wrong. §C is that arm, and it is the
--    keystone whose pre-migration state is "no exception, and a row was written".
--    ⛔ And the tenancy arm's closure today is INCIDENTAL (LEARN-058) — it comes from
--    a hat conjunct in a membership helper, at a LATER gate, for an unrelated reason.
--    §A P3 asserts that invisibility explicitly, because it is exactly what makes the
--    new refusal's POSITION load-bearing rather than decorative.
--
-- ⛔ SCOPE, stated so a reader does not infer more than is asserted:
--   · the refusal is on the PUBLIC DOOR only. `app._grant_case_access_unchecked` (the
--     INVOKER kernel), `create_case`'s creator self-grant and `revoke_case_access` are
--     UNTOUCHED — §F and §G are the twins that say so.
--   · it is on the ACT, not the payload: `read`, `write` and the PHI parameters are
--     refused alike (K1/K1c/K1d). A level-scoped reading would pass K1 and fail K1c.
--   · it is not a narrowing of AUTHORITY. §D is the paired positive (§7.7): the
--     tenancy-admin fallback arm and the coordinator arm both still GRANT to others.
--
-- ⭐ EVERY PRE-FLIGHT IS MEASURED IN THE CALLER'S OWN SESSION, not as `postgres`.
--    The first draft of this file asserted `app.is_tenancy_admin_of_for(comm, oa_b)`
--    with no claims set and got `true` — because the hat conjunct is short-circuited
--    when `auth.uid()` is NULL. The door sees something else entirely (LEARN-003). A
--    pre-flight taken outside the arm's own context is not a pre-flight.
--
-- ⚠ RED-FIRST HONESTY (§7.1). Against the PRE-migration catalog (head 20261003007370):
--   K1/K1c/K1d and K2 are RED catching `HC021`; K3/K3c are RED catching NO EXCEPTION
--   and K3b RED at 1 stored row. Everything else is GREEN before AND after and is
--   declared a CONTROL or a positive twin, never a keystone: §D (the arms that stay
--   open), §E (the ORDERING pin — a check that does not exist yet cannot be in the
--   wrong position), §F (the kernel), §G (revoke), §H (the door's shape).
--
-- ⚠ ALSO MEASURED, AND IT CONTRADICTS THE TASK TEXT THIS FILE WAS WRITTEN FROM: the
--   brief asked for "a coordinator's `create_case` still self-grants through the
--   kernel". It does NOT, and never did — `create_case` guards that call with
--   `if not (app.is_staff_admin_of(p_commission_id))`, skipping coordinators because
--   they already see the whole board (ADR 0061 revised). The creator self-grant fires
--   only for the capability-arm (administrativo) creator, so §F uses that persona. And
--   the kernel writes `source = 'manual_grant'` with `reason_code =
--   'creator_self_grant'` — the string names the REASON column, not the SOURCE column.
-- =============================================================================
begin;
select plan(34);

-- `create_case` (§F) is gated by two flags; flipped for this txn only, hermetically.
update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'processless_cases');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,     -- coordinator of comm_x — §C, the LIVE arm
         (v->>'st_x')::uuid   as st_x,     -- plain member of comm_x; §F's administrativo
         (v->>'st_x2')::uuid  as st_x2,    -- plain member of comm_x; §B's hospital_admin
         (v->>'st_y')::uuid   as st_y,     -- member of comm_y — NO standing in comm_x
         (v->>'oa_b')::uuid   as oa_b,     -- org_admin of the org — §A
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- ── THE PERSONAE, built here because the bootstrap has none of them ─────────
-- A · oa_b is an `org_admin` of the org that owns comm_x, given a plain `staff`
--     membership IN comm_x — the exact combination D6·5·1 describes.
insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_x from k), (select oa_b from k), 'staff');
-- B · st_x2 is already a plain `staff` of comm_x; a `hospital_admin` seat gives him
--     the OTHER leg of `app.is_tenancy_admin_of_for`. The door calls the disjunction,
--     so one leg proven is not the class.
insert into public.memberships (organization_id, hospital_id, principal_id, role)
  values ((select org_b from k), (select hosp_b from k), (select st_x2 from k), 'hospital_admin');
-- F · a NON-coordinator with `create_cases` — the only persona whose `create_case`
--     reaches the kernel's creator self-grant (see the header).
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values ((select comm_x from k), (select st_x from k), (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values ((select comm_x from k), (select st_x from k), 'create_cases', (select sa_x from k));

-- ── FIXTURE: one OPEN case in comm_x, fixed id (never a seed-random one). ────
insert into public.cases (id, commission_id, case_number, created_by)
values ('00000000-0000-0000-0000-000000417001', (select comm_x from k), 97001,
        (select sa_x from k));

-- ===========================================================================
-- ⭐ FIXTURE PRE-FLIGHT — the two gates DOWNSTREAM of the new refusal are proven
--    inert on this case, so no red below can be one of them firing instead.
-- ===========================================================================
select is(app.case_is_terminal('00000000-0000-0000-0000-000000417001'), false,
  'P0 ⭐: the case is OPEN — the terminal refusal (HC0U0) cannot pre-empt anything below');
select is(app.is_case_excluded('00000000-0000-0000-0000-000000417001', (select sa_x from k)), false,
  'P0b ⭐: the coordinator is NOT excluded — the U1 exclusion (HC0F1) cannot pre-empt §C');

-- ===========================================================================
-- §A · THE TENANCY ADMIN, ORG LEG — measured IN HER OWN SESSION, wearing the hat
--      that opens the door's fallback arm.
-- ===========================================================================
select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;

select is(app.is_tenancy_admin_of((select comm_x from k)), true,
  'P1 ⭐: wearing org_admin she DOES hold the door''s tenancy-admin arm — authority (42501) cannot pre-empt');
select is(app.is_staff_admin_of((select comm_x from k)), false,
  'P2 ⭐: …and NOT the coordinator arm — this is the fallback that D6·2 says "reads nothing"');
select is(app.is_member_of_for((select comm_x from k), (select oa_b from k)), false,
  'P3 ⭐⭐ THE CORRECTION: her own plain `staff` row is INVISIBLE under the org_admin hat (the ACT conjunct in app.has_role_any). Pre-migration the door therefore answered HC021 — an INCIDENTAL closure at a LATER gate. That is exactly why D6·5·1 puts the refusal EARLIER');

select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select oa_b from k), 'write')$$,
  'HC0U1', null,
  'K1 ⭐ ADR 0205 D6·5·1: the tenancy admin cannot grant HERSELF write — refused BEFORE membership, as an act');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select oa_b from k), 'read')$$,
  'HC0U1', null,
  'K1c ⭐ THE ACT, NOT THE PAYLOAD: the same refusal at level READ — a level-scoped guard would pass K1 and fail here');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select oa_b from k), 'read', null, null, true, true)$$,
  'HC0U1', null,
  'K1d ⭐ THE PHI PATH: the two SQL-only PHI parameters are refused too — D10 keeps them off the screen, this keeps them off the self');
reset role;

select is(
  (select count(*)::int from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000417001'
      and principal_id = (select oa_b from k)),
  0,
  'K1b ⭐: after THREE attempts the ledger holds no row for her — the refusal precedes the (upserting) kernel');

-- ===========================================================================
-- §B · THE TENANCY ADMIN, HOSPITAL LEG. `hospital_admin` is not a synonym
--      reachable by accident — the door calls a disjunction, and both arms refuse.
-- ===========================================================================
select test_helpers.claims_for((select st_x2 from k), false, 'hospital_admin');
set local role authenticated;
select is(app.is_tenancy_admin_of((select comm_x from k)), true,
  'P4 ⭐: st_x2 holds the tenancy arm through its HOSPITAL leg');
select is(app.is_staff_admin_of((select comm_x from k)), false,
  'P5 ⭐: …and no coordinator authority either');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select st_x2 from k), 'write')$$,
  'HC0U1', null,
  'K2 ⭐: a HOSPITAL_ADMIN self-granting is refused identically (the other tenancy leg)');
reset role;

select is(
  (select count(*)::int from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000417001'
      and principal_id = (select st_x2 from k)),
  0,
  'K2b: …and nothing was written for him either');

-- ===========================================================================
-- §C ⭐⭐ THE ARM THAT WAS ACTUALLY OPEN — the COORDINATOR. Both gates pass for
--        her, and pre-migration this self-grant SUCCEEDED and stored a row.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select is(app.is_staff_admin_of((select comm_x from k)), true,
  'P6 ⭐: sa_x holds the coordinator arm — so K3 is not a disguised 42501');
select is(app.is_member_of_for((select comm_x from k), (select sa_x from k)), true,
  'P7 ⭐⭐: …and her OWN membership IS visible under her own hat — BOTH gates pass, which is why the pre-migration self-grant succeeded');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select sa_x from k), 'write')$$,
  'HC0U1', null,
  'K3 ⭐⭐ THE HEADLINE: the COORDINATOR self-granting is refused — pre-migration this raised NO exception and wrote a row');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select sa_x from k), 'read', null, null, true, true)$$,
  'HC0U1', null,
  'K3c ⭐⭐: …including issuing HERSELF read_restricted_phi, which D5·6 lets a coordinator ISSUE without holding');
reset role;

select is(
  (select count(*)::int from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000417001'
      and principal_id = (select sa_x from k)),
  0,
  'K3b ⭐⭐: …and the ledger holds NO row for the coordinator (pre-migration: 1)');

-- ===========================================================================
-- §D · PAIRED POSITIVES (§7.7) — BOTH authority arms still GRANT to someone else.
--      A guard that closed either would satisfy §A–§C by construction.
-- ===========================================================================
select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select st_x from k), 'write')$$,
  'K4 ⭐ POSITIVE TWIN: the tenancy admin can still grant to SOMEONE ELSE — ADR 0078''s deadlock exit survives');
reset role;

select is(
  (select reason_code from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000417001'
      and principal_id = (select st_x from k) and revoked_at is null),
  'org_admin_deadlock_exit',
  'K4b: …and the stored row is stamped as the deadlock exit — the arm that ran is the arm named');

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select lives_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select st_x2 from k), 'read')$$,
  'K5 ⭐ POSITIVE TWIN: the coordinator can still grant to another member');
reset role;

select is(app.has_case_capability('00000000-0000-0000-0000-000000417001',
        (select st_x2 from k), 'read_case_content'), true,
  'K5b ⭐: …and that grant confers REAL reach through the resolver — "lives_ok" alone passes on an inert row');

-- ===========================================================================
-- §E · ORDERING PIN (a CONTROL, green before and after — see the header). The
--      refusal sits AFTER authority: a principal with NO standing asking for
--      HERSELF must still be told 42501, never which of her two failures the door
--      noticed first.
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false, 'staff');
set local role authenticated;
select ok(
  not app.is_staff_admin_of((select comm_x from k))
  and not app.is_tenancy_admin_of((select comm_x from k)),
  'P8 ⭐: st_y holds NEITHER authority arm in comm_x — the 42501 below is genuine');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select st_y from k), 'write')$$,
  '42501', null,
  'K6 ⭐ ORDERING: a principal with NO standing self-granting gets 42501, never HC0U1');
reset role;

select is(
  (select count(*)::int from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000417001'
      and principal_id = (select st_y from k)),
  0,
  'K6b: …and the 42501 is a refusal, not a silent pass — no row for her');

-- ===========================================================================
-- §F · THE KERNEL IS UNTOUCHED. `create_case`'s creator self-grant runs through
--      `app._grant_case_access_unchecked`, which this ruling does not narrow — the
--      one legitimate self-grant on the platform, and it must survive.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case((select comm_x from k), 'Caso do administrativo')).id as cid;
grant select on cse to authenticated;
reset role;

select is(
  (select reason_code from public.case_access_grants
    where case_id = (select cid from cse) and principal_id = (select st_x from k)),
  'creator_self_grant',
  'K7 ⭐ KERNEL UNTOUCHED: the capability-arm creator still SELF-grants on create_case (reason_code, NOT source)');
select is(
  (select read_case_content from public.case_access_grants
    where case_id = (select cid from cse) and principal_id = (select st_x from k)),
  true,
  'K7b: …and that creator row really carries read_case_content');

-- ===========================================================================
-- §G · REVOKE IS UNCHANGED — "giving access up is not an authority act"
--      (D6·5·1). A grantor-class principal may still revoke HERSELF.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select lives_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000417001',
      (select oa_b from k), 'read')$$,
  'K8a: the coordinator grants the tenancy admin a read — legal, because it is not a SELF-grant');
reset role;

select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  $$select public.revoke_case_access('00000000-0000-0000-0000-000000417001',
      (select oa_b from k))$$,
  'K8b ⭐ SCOPE: the tenancy admin may still SELF-REVOKE — revoke_case_access is not narrowed');
reset role;

select isnt(
  (select revoked_at from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000417001'
      and principal_id = (select oa_b from k)),
  null,
  'K8c: …and the self-revoke really landed — the row is soft-revoked, not merely un-refused');

-- ===========================================================================
-- §H · THE DOOR'S SHAPE DID NOT MOVE. A `create or replace` cannot change these,
--      but a body re-emitted from stale text could — so they are measured from the
--      catalog rather than assumed (ADR 0078: the catalog is the sole truth).
-- ===========================================================================
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'grant_case_access'),
  true,
  'K9a ⭐: grant_case_access is still SECURITY DEFINER (its gate REPLACES RLS — LEARN-074)');
select is(
  (select array_to_string(p.proconfig, ',') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'grant_case_access'),
  'search_path=app, public, pg_catalog',
  'K9b ⭐: the pinned search_path is unchanged — a DEFINER that loses it is the classic hijack');
select ok(
  has_function_privilege('authenticated',
    'public.grant_case_access(uuid,uuid,text,timestamp with time zone,text,boolean,boolean)'::regprocedure,
    'EXECUTE')
  and has_function_privilege('service_role',
    'public.grant_case_access(uuid,uuid,text,timestamp with time zone,text,boolean,boolean)'::regprocedure,
    'EXECUTE'),
  'K9c: the EXECUTE grants to authenticated + service_role survive the replace');
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace,
          lateral unnest(coalesce(p.proacl, '{}'::aclitem[])) a
    where n.nspname = 'public' and p.proname = 'grant_case_access'
      and a::text like '=%'),
  0,
  'K9d ⭐: PUBLIC still holds NO EXECUTE on the door (the REVOKE ALL FROM PUBLIC posture)');

select * from finish();
rollback;
