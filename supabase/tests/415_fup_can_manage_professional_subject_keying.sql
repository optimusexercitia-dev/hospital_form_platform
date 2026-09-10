-- 415 — FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM: the two professional-identity predicates
-- answer about `p_uid`, the parameter their signature promises, and not about the CALLER.
-- Subject: the pre-AE5 Batch 8 migration (ADR 0200), written RED-FIRST against head pair
-- (20261003007350, 524).
--
-- ⛔⛔ WHAT THIS SUITE IS FOR. Both `app.can_manage_professional(p_org, p_uid)` and
-- `app.can_read_professional_profile(p_profile_id, p_uid)` are parameterised on a principal and,
-- before ADR 0200, resolved their admin/org-authority arms against `auth.uid()`:
--
--     app.can_manage_professional      p_uid is not null and (is_admin() or is_org_admin_of(p_org))
--     app.can_read_professional_profile  if coalesce(is_admin(), false) then return true
--
-- `is_admin()` takes no argument and `is_org_admin_of(p_org)` reads `auth.uid()` twice, so a
-- third-party-shaped signature sat over a pure self-check. AE4.7c removed the staff_admin ascent —
-- the LAST arm that read the parameter — which is what turned one defective arm into two-of-two
-- and is recorded in the live body's own header comment ("narrowed rather than fixed").
--
-- ⚠ WHY NO ORACLE-EQUALITY CELL. The obvious assertion — `predicate = is_admin_for(p_uid) or
-- is_org_admin_of_for(p_org, p_uid)` — is exactly what the fixed body IS, so it would agree BY
-- CONSTRUCTION and prove nothing (LEARN-091: the value of a mirror is the day it disagrees).
-- Every ⭐ cell below instead pins a CONCRETE (caller, subject) coordinate whose correct answer is
-- known independently of either implementation.
--
-- ⚠ BIDIRECTIONAL, PER ARM, PER SITE. A one-directional mutation leaves the opposite polarity
-- unproven: an over-grant cell alone is satisfied by a predicate that denies everyone, an
-- under-grant cell alone by one that grants everyone. §1 carries an over-grant AND an under-grant
-- for EACH of `can_manage_professional`'s two arms; §2 carries both polarities for
-- `can_read_professional_profile`'s OWN first arm — the one that fires before it ever reaches
-- `can_manage_professional`, and which a fix to `can_manage_professional` alone would leave
-- defective (a partial fix that reads as a complete one).
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` — same reason as 401, 407 and 409: its
-- subject is the real seeded population, which bootstrap's `truncate … cascade` would destroy.
-- The one fixture row it creates is identified precisely and the whole file rolls back regardless.
--
-- ⚠ `claims_for` FIRST, `set local role authenticated` SECOND, always. `00_setup.sql`'s own header
-- records suites that reversed it: at that point `request.jwt.claims` is unset, `claims_for`'s
-- auto-derivation query runs as `authenticated` under `memberships`' RLS, sees zero rows, mints NO
-- claim, and every gated call fails closed — a whole file of vacuous denials.
--
-- ⚠ THE CELLS CALL THE PREDICATES DIRECTLY, NEVER THROUGH THE RLS POLICY.
-- `professional_profiles_select`'s first CASE arm
-- (`organization_id IN (select app.current_professional_read_organizations())`) is permissive and
-- short-circuits to true; a cell routed through the policy can be satisfied by that arm and would
-- measure nothing (LEARN-026, a mutation's effect masked by a legitimately-open arm).
--
-- RUN SHAPE: `Files=2, Tests=18` (17 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a
-- count mismatch.

begin;
select plan(17);

-- ============================================================================
-- §0 — FIXTURE + PRECONDITIONS. Every precondition is ASSERTED, never claimed (authz-handoff
-- §7.3). Two of them are the reason the ⭐ cells are attributable at all, not decoration.
-- ============================================================================

create temp table f415 on commit drop as
select
  (select p.id from public.profiles p where p.email = 'platform@test.local')      as pa,  -- profiles.is_admin = t
  (select p.id from public.profiles p where p.email = 'orgadmin.a@test.local')    as oa,  -- org_admin @ Rede A
  (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')    as sa,  -- staff_admin @ CCIH, NO org authority
  (select p.id from public.profiles p where p.email = 'staff1.qual.b@test.local') as xb,  -- staff_admin in the OTHER org
  (select m.organization_id from public.memberships m
     join public.profiles p on p.id = m.principal_id
    where p.email = 'orgadmin.a@test.local' and m.role = 'org_admin' limit 1)     as org,
  (select pp.professional_profile_id from public.professional_participants pp
     join public.case_participants cp on cp.participant_id = pp.participant_id
    where cp.removed_at is null limit 1)                                          as seated_prof;

-- The cells run under `set local role authenticated`, which cannot read a temp table created by
-- the suite's own role. (Same idiom as 409:86-88, 100, 110, 252.)
grant select on f415 to authenticated;

-- A PARTICIPATION-FREE subject for §2, because `can_read_professional_profile`'s arm 3 (the
-- case-committee traversal) masks its other arms for the seeded professional — 409 § 4.3/§ 4.4
-- measured that mask genuinely OPEN on this seed.
insert into public.professional_profiles (id, organization_id, full_name)
  values ('fb000000-0000-0000-0000-00000000f415', (select org from f415),
          '415 Sujeito Sem Participacao');

select is((select count(*)::int from (
            select pa as u from f415 union all select oa from f415
            union all select sa from f415 union all select xb from f415) t
          where t.u is not null), 4,
  '0.1 FIXTURE CONTROL: all four persona ids resolved, and the org did too (0.3). ⛔ A NULL uid '
  'denies for the wrong reason and asserts nothing — a plausible name is not a principal '
  '(authz-handoff §7.2).');

select is((select count(*)::int from public.profiles
            where id in (select pa from f415 union all select oa from f415
                         union all select sa from f415 union all select xb from f415)
              and is_admin = true), 1,
  '0.2 ⭐⭐ EXACTLY ONE of the four personas carries `profiles.is_admin = true`, and it is `pa`. '
  '⛔ THIS IS NOT BOOKKEEPING. `test_helpers.claims_for(u, p_is_admin, …)` takes `p_is_admin` as '
  'an ARGUMENT and does not read `profiles`, so a fixture may mint a claim that DISAGREES with '
  'the row. `app.is_admin()` trusts the claim; `app.is_admin_for()` reads `profiles`. A divergent '
  'principal would make every ⭐ cell below flip for a FIXTURE reason rather than a predicate '
  'one, and it would read exactly like a real defect (ADR 0200 § Consequences, the R3 '
  'tightening).');

select ok((select org from f415) is not null
          and exists (select 1 from public.memberships m
                       where m.principal_id = (select oa from f415)
                         and m.role = 'org_admin' and m.organization_id = (select org from f415))
          and not exists (select 1 from public.memberships m
                           where m.principal_id = (select sa from f415)
                             and m.role = 'org_admin' and m.organization_id = (select org from f415)),
  '0.3 ⭐ THE AUTHORITY IS LOCATED, AND ITS ABSENCE TOO: `oa` holds `org_admin` at `org`, `sa` '
  'does not. An affiliation LOCATES a scope and a `memberships` row GRANTS (Architecture Rule '
  '13) — the ⭐ cells below difference exactly these two facts, so both halves are pinned.');

select is((select count(*)::int from public.professional_participants
            where professional_profile_id = 'fb000000-0000-0000-0000-00000000f415'), 0,
  '0.4 ⭐ THE MASK IS CLOSED for §2''s subject: it has no `professional_participants` row, so '
  '`can_read_professional_profile`''s arm-3 case-committee traversal cannot grant it and §2''s '
  'flips are attributable to arm 1 alone. ⛔ Not hypothetical — 0.5 is why.');

select ok((select seated_prof from f415) is not null
          and (select seated_prof from f415) <> 'fb000000-0000-0000-0000-00000000f415',
  '0.5 ⭐⭐ DISCRIMINATION CONTROL for 0.4, and the reason 0.4 is not decoration: a DIFFERENT, '
  'seeded professional IS seated in a live case, so the masking arm is genuinely reachable in '
  'this fixture and 0.4''s zero is an observation, not a stuck query. ⛔ A negative control '
  'cannot see a dead instrument.');

select ok(authz.has_permission((select sa from f415), 'organization', (select org from f415),
                               'org.professionals.read'),
  '0.6 ⭐⭐ THE SECOND MASK, MEASURED OPEN: `chefe.ccih` DOES hold `org.professionals.read` at '
  'this org (staff_admin is the one granted role, 409 § 0.4). So the re-keyed arm of '
  '`can_read_professional_profile` grants for `sa` regardless of arm 1 — which is exactly WHY '
  '§2''s over-grant cell uses the CROSS-ORG `xb` as its subject and not `sa`. Choosing the '
  'subject without this measurement would have produced a cell that could not go green.');

select ok(not authz.has_permission((select xb from f415), 'organization', (select org from f415),
                                   'org.professionals.read'),
  '0.7 ⭐ ...AND THE CHOSEN SUBJECT IS OUTSIDE IT: `xb` holds `staff_admin` in the OTHER '
  'organization, and `authz.scope_reaches` ascends without crossing tenants (409 § 4.12). So for '
  '`xb` all three non-admin arms of the read gate are shut and § 2.1 measures arm 1 alone.');

-- ============================================================================
-- §1 — `app.can_manage_professional(p_org, p_uid)`.
--   arm 1: the platform-admin arm  — was `coalesce(app.is_admin(), false)`, re-keyed to the
--          subject-keyed `_for` twin by ADR 0200, and ⚠ REMOVED ENTIRELY by ADR 0201 D5
--          (pre-AE5 Batch 10, 2026-09-10). ⛔ DATED CORRECTION: this header read "BOTH ARMS,
--          BOTH POLARITIES" and described arm 1 as a live arm with two polarities. It is no
--          longer an arm at all, and a file describing an arm it no longer tests is exactly
--          the staleness this correction exists to prevent. 1.1 and 1.2 now assert arm 1's
--          ABSENCE — both are denials, and §1 keeps its bidirectionality through arm 2 alone
--          (1.3 under-grant, 1.5 over-grant), which is why neither may be read as "the
--          predicate denies everyone".
--   arm 2: the org-authority arm   — was `app.is_org_admin_of(p_org)`, now the subject-keyed
--          `app.is_org_admin_of_for(p_org, p_uid)`, and since D5 the ONLY arm.
-- Exactly one fact changes between each ⭐ pair and its discrimination twin: WHO IS ASKING.
-- ============================================================================

select test_helpers.claims_for((select pa from f415), true, 'platform_admin');
set local role authenticated;
select ok(not app.can_manage_professional((select org from f415), (select sa from f415)),
  '1.1 ⭐⭐ ARM 1, OVER-GRANT — THE DEFECT THE FOLLOW-UP NAMES. A `platform_admin` asks about '
  '`chefe.ccih`, who is NOT an admin and holds NO org authority. The correct answer is FALSE. '
  'Before ADR 0200 this returned TRUE, because `is_admin()` answered about the ASKER. RED at '
  'head (20261003007350), green after.');
reset role;

select test_helpers.claims_for((select sa from f415), false, 'staff_admin');
set local role authenticated;
select ok(not app.can_manage_professional((select org from f415), (select pa from f415)),
  '1.2 ⭐⭐ ARM 1 IS GONE (ADR 0201 D5). The same staff_admin asks about the PLATFORM ADMIN and '
  'is now denied: an admin subject carries no authority over a tenant''s professional registry. '
  '⛔ THIS IS NOT A POLARITY FLIP OF THE OLD CELL — the old cell was arm 1''s UNDER-GRANT twin, '
  'and with arm 1 removed there is no under-grant polarity left AT ARM 1. §1 stays bidirectional '
  'through arm 2: 1.3 (under-grant, TRUE) and 1.5 (over-grant, FALSE). ⛔ Read 1.1 and 1.2 '
  'together as "the arm is absent", never as "the predicate denies everyone" — 1.3 and 1.6 are '
  'what forbid that reading.');

select ok(app.can_manage_professional((select org from f415), (select oa from f415)),
  '1.3 ⭐⭐ ARM 2, UNDER-GRANT. The same staff_admin caller asks about the ORG_ADMIN of this org. '
  'The correct answer is TRUE. Before ADR 0200 this returned FALSE, because '
  '`is_org_admin_of(p_org)` read `auth.uid()` — this is the assertion 406 § 2.3''s own comment '
  'says could not be written ("the arm reads auth.uid(), not p_uid"), and it is what makes that '
  'file''s workaround unnecessary.');

select ok(not app.can_manage_professional((select org from f415), (select sa from f415)),
  '1.4 DISCRIMINATION, SELF-NEGATIVE: the staff_admin asks about HERSELF and is still denied. '
  'AE4.7c narrowed row 30 to org authority and a staff_admin has none — so the SELF answers must '
  'not move. Green before AND after; this is the no-regression claim asserted rather than '
  'argued.');
reset role;

select test_helpers.claims_for((select oa from f415), false, 'org_admin');
set local role authenticated;
select ok(not app.can_manage_professional((select org from f415), (select xb from f415)),
  '1.5 ⭐⭐ ARM 2, OVER-GRANT. An ORG_ADMIN of this org asks about a staff_admin of the OTHER '
  'organization, who has no authority here at all. The correct answer is FALSE. Before ADR 0200 '
  'this returned TRUE, because arm 2 answered about the asker''s own org role. ⛔ 1.3 alone is '
  'satisfied by a predicate that grants everyone; this is its twin.');

select ok(app.can_manage_professional((select org from f415), (select oa from f415)),
  '1.6 DISCRIMINATION, SELF-POSITIVE: the org_admin asks about HERSELF and still passes. Green '
  'before AND after. Together with 1.4 this pins both SELF polarities, which is the entire '
  'population every production caller of this predicate actually constructs (ADR 0200 § Context: '
  '20 call expressions in the closure, all resolving to `auth.uid()`).');
reset role;

-- ============================================================================
-- §2 — `app.can_read_professional_profile(p_profile_id, p_uid)`, ITS OWN FIRST ARM.
-- ⛔ THIS SECTION IS NOT A PROPAGATION TEST. `can_read_professional_profile` carries its own
-- `if coalesce(app.is_admin(), false) then return true;` which fires BEFORE it ever calls
-- `can_manage_professional`. Fixing only the predicate the follow-up names would leave the
-- follow-up's OWN stated consequence — "a platform_admin asking whether X may read this profile
-- gets TRUE because the asker is an admin" — still true. PO ruling R2 is why both are here, and
-- these four cells are what make the second site individually attributable.
-- ============================================================================

select test_helpers.claims_for((select pa from f415), true, 'platform_admin');
set local role authenticated;
select ok(not app.can_read_professional_profile('fb000000-0000-0000-0000-00000000f415',
                                                (select xb from f415)),
  '2.1 ⭐⭐ ARM 1, OVER-GRANT — THE SECOND SITE OF THE SAME DEFECT. A `platform_admin` asks '
  'whether the CROSS-ORG staff_admin may read a Rede A professional. Correct answer FALSE: 0.7 '
  'proves the permission arm is shut for `xb` and 0.4 proves the committee arm cannot fire. '
  'Before ADR 0200 this returned TRUE at the FIRST LINE. ⛔ A fix to `can_manage_professional` '
  'alone leaves this cell RED, which is precisely why it is here.');

select ok(app.can_read_professional_profile('fb000000-0000-0000-0000-00000000f415',
                                            (select pa from f415)),
  '2.2 DISCRIMINATION, SELF-POSITIVE: the same platform_admin asks about HERSELF, wearing the '
  'hat, and still reads. Green before AND after — 2.1 must not be satisfied by an arm that now '
  'denies everyone.');
reset role;

select test_helpers.claims_for((select sa from f415), false, 'staff_admin');
set local role authenticated;
select ok(app.can_read_professional_profile('fb000000-0000-0000-0000-00000000f415',
                                            (select pa from f415)),
  '2.3 ⭐⭐ ARM 1, UNDER-GRANT — the opposite polarity AT THE SAME SITE. A commission staff_admin '
  'asks about the PLATFORM ADMIN; the correct answer is TRUE because the SUBJECT is an admin. '
  'Before ADR 0200 this returned FALSE. ⛔ Measured, not assumed, that no other arm supplies '
  'this TRUE: the org arm is `can_manage_professional(org, pa)` (arm 1 again), the permission '
  'arm is FALSE for `pa` (a platform_admin is role-free and holds no `org.professionals.read` '
  'grant), and 0.4 shuts the committee arm. So this cell moves with arm 1 alone.');
reset role;

select test_helpers.claims_for((select xb from f415), false, 'staff_admin');
set local role authenticated;
select ok(not app.can_read_professional_profile('fb000000-0000-0000-0000-00000000f415',
                                                (select xb from f415)),
  '2.4 DISCRIMINATION, SELF-NEGATIVE, AND THE CROSS-TENANT CONTROL: the other org''s staff_admin '
  'asks about HERSELF and reads nothing. Green before AND after. ⛔ Without this, 2.3 is '
  'satisfied by an arm that grants everyone, and 2.1''s green could have been tenant isolation '
  'collapsing rather than the keying being fixed.');
reset role;

select test_helpers.reset_role_and_claims();

-- ⚠ The file rolls back, but the fixture row is deleted explicitly anyway: an out-of-transaction
-- run (a hand `\i`, a diagnostic session) would otherwise leave a professional profile behind in
-- a real organization. Same discipline as 409's tail.
delete from public.professional_profiles where id = 'fb000000-0000-0000-0000-00000000f415';

select * from finish();
rollback;
