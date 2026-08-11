-- ACT Stage 3 (ADR 0106 D5/D11) — keystones for the two class-4 hat-blind caller
-- gates closed by `20260918002800`: a boolean gate that RECEIVES the caller's uid
-- as a parameter rather than reading auth.uid() itself.
--
-- RED-FIRST: every ⭐ DISTINGUISHING assertion below was confirmed RED against the
-- catalog BEFORE the migration was applied (the pre-fix functions returned true /
-- the grant SUCCEEDED under a non-matching hat). A keystone that could not fail is
-- the failure mode this project has logged repeatedly.
--
-- The fixture shape is the one Stage 3 uses throughout: ONE synthetic principal
-- holding several genuine entitlements, exercised one hat at a time — the only
-- fixture that can distinguish "passes because THIS hat is active" from "passes
-- regardless of hat". A single-role principal proves nothing here, because the
-- token hook derives its lone hat implicitly and the two implementations agree.

begin;
select plan(12);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b,
         (v->>'admin')::uuid  as admin_id
  from ctx;
grant select on k to authenticated;

-- ── PART 1 — app.is_admin_for(uuid) (QA BLOCKER-1) ──────────────────────────────
--
-- The synthetic multi-role platform_admin: the ONLY fixture that can distinguish
-- D11's two implementations. bootstrap's `admin` carries profiles.is_admin = true;
-- give it a real membership so it has a SECOND hat to wear. This is exactly the
-- population the D11 tripwire watches for — zero such principals exist in
-- production seed today, which is why the "provable no-op" argument holds and why
-- it needs a synthetic fixture to test at all.
insert into public.memberships (commission_id, principal_id, role)
values ((select comm_x from k), (select admin_id from k), 'staff');

-- Baseline: wearing the platform_admin hat, the entitlement reads TRUE (no
-- regression — the fix must not break the break-glass path ADR 0106 protects).
select test_helpers.claims_for((select admin_id from k), true, 'platform_admin');
set local role authenticated;
select ok(
  app.is_admin_for((select admin_id from k)),
  'is_admin_for(self) D11: TRUE while wearing the platform_admin hat (no regression)');
select ok(
  app.is_admin(),
  'is_admin() D11 agrees with its sibling under the platform_admin hat');
reset role;

-- ⭐ DISTINGUISHING: the same principal wearing a hat it also genuinely holds.
select test_helpers.claims_for((select admin_id from k), true, 'staff');
set local role authenticated;
select ok(
  not app.is_admin_for((select admin_id from k)),
  'is_admin_for(self) D11 ⭐ DISTINGUISHING: FALSE while wearing the staff hat (was TRUE pre-fix — the caller gate on the grant door)');
-- ⭐ QA r2 INFO-4: this assertion used to READ `ok(not app.is_admin())` while its
-- message claimed the two siblings "agree" — a message asserting more than its
-- expression checks, which stayed GREEN under neutralization while they genuinely
-- diverged. Now it compares them directly, so it detects the divergence it names
-- (RED pre-fix: is_admin()=false vs is_admin_for(self)=true — that gap WAS the bug).
select is(
  app.is_admin(),
  app.is_admin_for((select admin_id from k)),
  'is_admin() vs is_admin_for(self) ⭐ DISTINGUISHING: the siblings AGREE under a non-matching hat (they DIVERGED pre-fix)');
reset role;

-- ⭐ THIRD-PARTY INVARIANT (ADR 0106 §2): one principal''s hat must never change
-- what the system concludes about ANOTHER principal. st_x asking about admin_id
-- gets the unconditional entitlement answer, whatever st_x is wearing.
select test_helpers.claims_for((select st_x from k), false, 'staff');
set local role authenticated;
select ok(
  app.is_admin_for((select admin_id from k)),
  'is_admin_for(other) ⭐ THIRD-PARTY: unchanged by the asker''s hat — st_x still reads admin_id as a platform_admin');
reset role;

-- ⭐ THE REAL DOOR: `public.grant_role` binds p_actor := auth.uid(), so
-- `is_admin_for(p_actor)` inside grant_role_impl gates the CALLER. Pre-fix this
-- SUCCEEDED under the staff hat — a platform_admin could seat an org_admin while
-- wearing an unrelated hat, the exact escalation D11 refuses.
select test_helpers.claims_for((select admin_id from k), true, 'staff');
set local role authenticated;
select throws_ok(
  format($$ select public.grant_role('organization', %L, 'org_admin', %L) $$,
         (select org_b from k), (select st_x from k)),
  '42501', null,
  'grant_role(org_admin) D11 ⭐ DISTINGUISHING: REFUSED to a staff-hatted platform_admin (SUCCEEDED pre-fix)');
select throws_ok(
  format($$ select public.grant_role('hospital', %L, 'hospital_admin', %L) $$,
         (select hosp_b from k), (select st_x from k)),
  '42501', null,
  'grant_role(hospital_admin) D11 ⭐ DISTINGUISHING: the SYMMETRIC is_admin_for arm (ADR 0097 D17) is equally hat-gated');
reset role;

-- Break-glass no-regression: the same grant SUCCEEDS under the correct hat, so
-- the fix closed an escalation without stranding the provisioning path ADR 0097
-- D17 exists to keep open.
select test_helpers.claims_for((select admin_id from k), true, 'platform_admin');
set local role authenticated;
select lives_ok(
  format($$ select public.grant_role('hospital', %L, 'hospital_admin', %L) $$,
         (select hosp_b from k), (select st_x from k)),
  'grant_role(hospital_admin) D11: still SUCCEEDS under the platform_admin hat (break-glass intact)');
reset role;

-- ── PART 2 — app.can_manage_professional (QA MAJOR-1) ───────────────────────────
--
-- ⚠ UPDATED BY BUG-ACT-EXPIRY-1 (`20260918003000`), which is the change this block
-- anticipated in writing: "If the expiry quirk is ever closed, THIS assertion is
-- expected to change with it — that is the bug''s own change and its own gate, not a
-- silent edit here." The expired-staff_admin compensating clause Stage 2 preserved is
-- now GONE; `has_role` is the only membership path, so expiry is honoured. Assertion
-- 10 below is therefore INVERTED from what it read at Stage 3 — the polarity flip IS
-- the fix''s keystone, and it was confirmed RED against the pre-fix catalog.
--
-- ⭐ QA r2 MINOR-4(2): the fixture is the REACHABLE cross-org shape, not a synthetic
-- one. sa_x keeps its LIVE staff_admin on comm_x (org_b) and additionally holds an
-- EXPIRED staff_admin in a SECOND org. That principal has exactly one LIVE role type,
-- so `custom_access_token_hook` derives the staff_admin hat implicitly — no picker, no
-- hand-minted claim, a state a real user can actually occupy. The previous version of
-- this twin minted a staff_admin hat for an expired-ONLY principal, which `assume_role`
-- and the hook both refuse to issue: it pinned the function's logic against a state
-- nobody can reach. This one pins the same claim against a reachable one — and it is
-- the shape BUG-ACT-EXPIRY-1 had to close, because Stage 3''s hat condition had
-- already made every OTHER expired shape unreachable on its own.
create temp table o2 on commit drop as select gen_random_uuid() as org, gen_random_uuid() as hosp;
grant select on o2 to authenticated;
insert into public.organizations (id, name, slug)
  values ((select org from o2), 'Org Expiry Twin', 'org-expiry-twin');
insert into public.hospitals (id, organization_id, name, slug)
  values ((select hosp from o2), (select org from o2), 'Hosp Expiry Twin', 'hosp-expiry-twin');
insert into public.commissions (name, slug, created_by, hospital_id)
  values ('Comissão Expiry Twin', 'comm-expiry-twin', (select admin_id from k), (select hosp from o2));
create temp table c2 on commit drop as
  select id from public.commissions where slug = 'comm-expiry-twin';
grant select on c2 to authenticated;

insert into public.memberships (commission_id, principal_id, role, expires_at)
values ((select id from c2), (select sa_x from k), 'staff_admin', now() - interval '1 day');

-- Precondition, asserted rather than assumed: has_role() already refuses the
-- expired row, so anything still passing can ONLY be the raw arm under test.
-- (No explicit hat: `claims_for` mirrors the hook's own derive, which is the point.)
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(
  not app.has_role('commission', (select id from c2), 'staff_admin', (select sa_x from k)),
  'precondition: has_role() refuses the EXPIRED staff_admin row (so the raw arm is what the next assertions measure)');
reset role;

-- ⭐ DISTINGUISHING for BUG-ACT-EXPIRY-1 (`20260918003000`), and RED pre-fix: this
-- is the exact assertion that read `ok(app.can_manage_professional(...))` at Stage 3.
-- The hat is derived implicitly from the LIVE membership in the OTHER org, which is
-- what made this the one surviving reach of the quirk — every other expired shape was
-- already unreachable because an expired-ONLY principal can never obtain the
-- staff_admin hat at all (`assume_role` validates live holding; the hook derives only
-- from live rows). So the principal here is correctly hatted, genuinely holds
-- staff_admin somewhere, and is asking about an org where its staff_admin has
-- EXPIRED. Post-fix the only membership path is `has_role`, which filters expiry —
-- hence FALSE.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(
  not app.can_manage_professional((select org from o2), (select sa_x from k)),
  'can_manage_professional ⭐ BUG-ACT-EXPIRY-1: an EXPIRED staff_admin is REFUSED even under a correctly-derived staff_admin hat (was TRUE pre-fix — the cross-org reach)');

-- CONTROL, and it is load-bearing: without it the assertion above passes for free if
-- anyone breaks the function closed (or deletes the membership arm outright), and a
-- detector that cannot distinguish "correctly refused" from "refuses everything" is
-- not a detector. Same principal, same hat, same session — only the org differs, and
-- there sa_x's staff_admin is LIVE. This is the boundary the fix must NOT cross.
select ok(
  app.can_manage_professional((select org_b from k), (select sa_x from k)),
  'can_manage_professional CONTROL: the LIVE staff_admin in the other org is still ADMITTED (proves the assertion above is not a broken-closed pass)');
reset role;

-- ⭐ DISTINGUISHING for D5 (the hat dimension), RE-ANCHORED ONTO THE LIVE ARM.
-- At Stage 3 this twin measured the EXPIRED arm under a non-staff_admin hat. That
-- arm no longer exists, so keeping it there would have left a control anchored on a
-- defect — true by construction once the defect was fixed, and unable to fail for the
-- reason its own message claims. It now measures the LIVE arm instead, which is
-- correct BY DESIGN and therefore a durable anchor: `has_role` carries the same
-- caller-only hat condition internally, so the hat dimension is still genuinely
-- under test.
-- The second hat is hospital-scoped `quality_reviewer` (the shape keystone 316 uses)
-- chosen deliberately: it feeds NONE of this function's arms — not `is_admin()`, not
-- `is_org_admin_of(p_org)`, not `has_role(commission, …, 'staff_admin')` — so a green
-- here cannot be a pass for the wrong reason. Adding it also gives sa_x a SECOND live
-- role type, so the hat is now a genuine choice rather than an implicit derive —
-- exactly the population ADR 0106 exists for.
insert into public.memberships (organization_id, hospital_id, principal_id, role)
values ((select org_b from k), (select hosp_b from k), (select sa_x from k), 'quality_reviewer');

select test_helpers.claims_for((select sa_x from k), false, 'quality_reviewer');
set local role authenticated;
select ok(
  not app.can_manage_professional((select org_b from k), (select sa_x from k)),
  'can_manage_professional D5 ⭐ DISTINGUISHING: the LIVE staff_admin arm does NOT fire under the quality_reviewer hat (the same principal was ADMITTED one assertion ago under the staff_admin hat)');
reset role;

select * from finish();
rollback;
