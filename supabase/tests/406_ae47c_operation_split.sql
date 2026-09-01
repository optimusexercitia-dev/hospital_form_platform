-- 406 — AE4.7c: the ADD/MODIFY split, and the FAIL-OPEN direction nothing else measures.
-- Subjects: 20261003007220 (family split) + 20261003007230 (operation split + grant change).
-- Spec: docs/design/authz-ae43-staff-admin-permission-matrix.md § 12.8.5.
--
-- ⛔ THIS FILE EXISTS BECAUSE EVERY OTHER SUITE MEASURES THE SAME DIRECTION. 228, 229, 257,
-- 318, 320, 321 and 401 all changed for AE4.7c, and with one exception every changed assertion
-- measures access being REMOVED. Matrix § 12.8.5 names the gap in terms:
--
--     "Everything above measures access being *removed*. Nothing would notice
--      can_create_professional being written too wide, or the link_state = 'unknown' bound
--      being dropped. AE4.7c owes a positive/negative pair on each."
--
-- A revoke is easy to prove. What is hard — and what a revoke's own tests structurally cannot
-- see — is that the REPLACEMENT is not wider than the thing it replaced, and that the one
-- capability `staff_admin` KEEPS is bounded where the ruling says it is bounded.
--
-- ⚠ THE PAIRING IS THE POINT THROUGHOUT. Each denial below sits beside an admission by a
-- principal who SHOULD pass, on the same door, in the same transaction. A denial with no
-- positive twin is satisfied by a door that is broken shut — and a door broken shut is how a
-- capability disappears from a product with every test still green.
--
-- RUN SHAPE: `Files=2, Tests=19` (18 here + 00_setup.sql's one).

begin;
select plan(18);

-- ============================================================================
-- §1 — the fixture. Three principals spanning the split, from the SEED (not bootstrap):
-- a commission staff_admin, an org_admin of the SAME org, and a platform_admin.
-- ============================================================================

create temp table f406 on commit drop as
select
  (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')       as sa,
  (select p.id from public.profiles p where p.email = 'orgadmin.a@test.local')       as oa,
  (select p.id from public.profiles p where p.email = 'platform@test.local')         as pa,
  (select app.org_of_commission(m.commission_id)
     from public.memberships m join public.profiles p on p.id = m.principal_id
    where p.email = 'chefe.ccih@test.local' and m.role = 'staff_admin' limit 1)      as org;

select ok((select sa from f406) is not null and (select oa from f406) is not null
          and (select pa from f406) is not null and (select org from f406) is not null
          and (select org from f406) = (select m.organization_id from public.memberships m
                                         join public.profiles p on p.id = m.principal_id
                                        where p.email = 'orgadmin.a@test.local'
                                          and m.role = 'org_admin' limit 1),
  '1.1 FIXTURE CONTROL: a commission staff_admin and an org_admin resolve, AND they are in the '
  'SAME organization. ⛔ Every contrast below is attributable only if the org matches — an '
  'org_admin of a DIFFERENT org would be denied for tenancy reasons and every "org authority '
  'still passes" twin would silently become an isolation test.');

-- ============================================================================
-- §2 — THE CAPABILITY LINE, at the predicate level, on ONE principal.
-- ============================================================================

select ok(app.can_create_professional((select org from f406), (select sa from f406)),
  '2.1 ADD: a commission staff_admin MAY create/seat/link a professional org-wide (matrix row '
  '43, org.professionals.create). ⚠ The org-wide ascent survives the split deliberately — '
  'AE4.7c bounds row 30 by OPERATION, and § 12.7 keeps the scope anomaly on the record rather '
  'than pretending the split dissolved it.');

select ok(not app.can_manage_professional((select org from f406), (select sa from f406)),
  '2.2 ⭐⭐ MODIFY: the SAME principal MAY NOT update or redact one. This single line is '
  'AE4.7c. ⛔ It is only worth anything beside 2.1 and 2.3: alone it is satisfied by a gate '
  'that returns false for everyone, which is precisely what an over-eager revoke produces.');

-- ⛔⛔ THE ORG-AUTHORITY ARM IS ONLY OBSERVABLE AS A SELF-CHECK, AND THIS COST A RED TO LEARN.
-- 2.1 and 2.2 above pass `sa` as `p_uid` and work as THIRD-PARTY evaluations, because the
-- staff_admin ascent genuinely reads the parameter. `is_org_admin_of(p_org)` does NOT — it
-- reads the CALLER's auth.uid(), and so does `is_admin()`. So passing `oa` as `p_uid` with no
-- claims set measures nothing at all: both assertions returned FALSE, on a correct tree.
-- ⭐ That is FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM, demonstrated rather than described,
-- and AE4.7c SHARPENED it: with the ascent gone, `can_manage_professional`'s `p_uid` is a null
-- guard and nothing else — a third-party-shaped signature over a pure self-check. The claims
-- switch below is the workaround; the FUP is the thing to fix, and it is a PO item.
select test_helpers.claims_for((select oa from f406), false, 'org_admin');
select ok(app.can_manage_professional((select org from f406), (select oa from f406)),
  '2.3 ⭐ AND ORG AUTHORITY KEEPS IT: an org_admin of the same org still passes row 30. This '
  'is 2.2''s over-revoke twin — the assertion that distinguishes "narrowed to org authority" '
  'from "closed". ⚠ Asked AS the org_admin: the arm reads auth.uid(), not p_uid.');

select ok(app.can_create_professional((select org from f406), (select oa from f406)),
  '2.4 CONTAINMENT, behaviourally: whoever may MODIFY may also ADD. A split that had made the '
  'two populations disjoint would pass 2.1-2.3 and strand org_admin outside the create path.');
select test_helpers.reset_role_and_claims();

select ok(
  (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\mcan_manage_professional\M'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_create_professional'),
  '2.5 ⭐ CONTAINMENT, STRUCTURALLY — and this is the durable half of 2.4. '
  '`can_create_professional` is written as `can_manage_professional OR the ascent`, so '
  'create ⊇ manage holds BY CONSTRUCTION rather than by two bodies that happen to agree today. '
  '⛔ A future edit that copies the org-authority arms instead of delegating would keep 2.4 '
  'green and re-open the divergence this file exists to close.');

-- ============================================================================
-- §3 — THE CATALOG HALF, and its agreement with §2. AE4.5's oracle asserts
-- legacy == catalog across all 657 cells; this asserts the two SPECIFIC codes the
-- split moved, at the one scope where the movement is observable.
-- ============================================================================

select is(
  (select count(*)::int from authz.role_permissions
    where role_code = 'staff_admin'
      and permission_code in ('org.professionals.create', 'org.professionals.manage')),
  1,
  '3.1 the catalog records EXACTLY ONE of the two codes for staff_admin — 3.2 names which.');

select ok(
  exists (select 1 from authz.role_permissions
           where role_code = 'staff_admin' and permission_code = 'org.professionals.create')
  and not exists (select 1 from authz.role_permissions
                   where role_code = 'staff_admin' and permission_code = 'org.professionals.manage'),
  '3.2 ⭐ …and it is `create` that is held and `manage` that is not. ⛔ 3.1 alone is satisfied '
  'by the exact inversion of the ruling, which would be a silent widening of the capability the '
  'PO removed and a removal of the one they kept.');

select test_helpers.claims_for((select sa from f406), false, 'staff_admin');
select ok(
  authz.has_direct_permission((select sa from f406), 'organization', (select org from f406),
                              'org.professionals.create'),
  '3.3 THE RESOLVER AGREES, granted side: the catalog answer for the code staff_admin keeps.');

select ok(
  not authz.has_direct_permission((select sa from f406), 'organization', (select org from f406),
                                  'org.professionals.manage'),
  '3.4 ⭐⭐ THE RESOLVER AGREES, denied side — AND THIS IS THE CELL 403 CAN NO LONGER SEE. '
  'AE4.7c re-pointed the differential''s org representative from `.manage` to `.create` '
  '(a rep the subject role does not hold makes every cell of its class a denial, which is a '
  'coverage loss no arm names). That re-point is correct and it leaves row 30 with no '
  'representative in the 657-cell sweep. This assertion is what stands in for it.');
select test_helpers.reset_role_and_claims();

-- ============================================================================
-- §4 — THE `link_state` BOUND. `set_professional_link_state` is KEPT for staff_admin
-- because it COMPLETES an add — but the door accepts transitions the UI never offers,
-- so the bound is enforced at the door rather than trusted to the component that
-- happens to hide the button (matrix § 12.8.5: the *no UI ≠ not reachable* class).
-- ============================================================================

-- ⚠ f406 is read under `set local role authenticated` in §5, so it needs the grant too —
-- without it that block dies on a permission error rather than measuring the mutation.
grant select on f406 to authenticated;

create temp table f406p on commit drop as
  select '00000000-0000-0000-0000-0000004060a1'::uuid as unknown_profile,
         '00000000-0000-0000-0000-0000004060a2'::uuid as linked_profile;
grant select on f406p to authenticated;

insert into public.professional_profiles (id, organization_id, full_name, link_state)
  select unknown_profile, (select org from f406), 'Dr. Não Resolvido', 'unknown' from f406p;
insert into public.professional_profiles (id, organization_id, full_name, link_state, user_id)
  select linked_profile, (select org from f406), 'Dr. Já Vinculado', 'linked', (select oa from f406) from f406p;

select is(
  (select array_agg(link_state order by id) from public.professional_profiles
    where id in ((select unknown_profile from f406p), (select linked_profile from f406p))),
  array['unknown', 'linked'],
  '4.0 FIXTURE CONTROL: one profile at `unknown` and one at `linked`. ⛔ The whole of §4 is a '
  'contrast between these two states; if both rows landed in the same state every assertion '
  'below would still run and half of them would mean nothing.');

select test_helpers.claims_for((select sa from f406), false, 'staff_admin');
set local role authenticated;
select lives_ok(
  format($$ select public.set_professional_link_state(%L, 'no_account', null) $$,
         (select unknown_profile from f406p)),
  '4.1 ⭐ COMPLETING AN ADD PASSES: a staff_admin resolves a profile sitting at `unknown`. '
  'This is the "Resolver vínculo" flow, and it is the capability the ruling deliberately KEPT '
  '— an over-tight bound that denied it would strand the add path exactly as ruling 1 would '
  'have (matrix § 12.8.3).');

select throws_ok(
  format($$ select public.set_professional_link_state(%L, 'no_account', null) $$,
         (select linked_profile from f406p)),
  '42501', null,
  '4.2 ⭐⭐ ALTERING AN ESTABLISHED LINKAGE IS REFUSED: the same staff_admin, the same door, '
  'the same target state — only the profile''s CURRENT state differs. ⛔ Without the bound this '
  'RPC moves a `linked` profile to `no_account` and breaks a real account association, because '
  'nothing in the door read the current state. The UI never offers it; the door did.');
reset role;

select is(
  (select link_state from public.professional_profiles where id = (select linked_profile from f406p)),
  'linked',
  '4.2b …AND THE REFUSAL IS NOT COSMETIC: the row is untouched. A door that raised after '
  'writing would satisfy 4.2 and still have done the damage.');

select test_helpers.claims_for((select oa from f406), false, 'org_admin');
set local role authenticated;
select lives_ok(
  format($$ select public.set_professional_link_state(%L, 'no_account', null) $$,
         (select linked_profile from f406p)),
  '4.3 ⭐ OVER-REACH TWIN: org authority moves the SAME established linkage. The bound is '
  '`staff_admin`-only and unrestricted for org_admin, exactly as ruled. ⛔ This is what proves '
  '4.2 measures the BOUND and not a door that stopped working — and 4.2 alone would be equally '
  'well explained by a broken `set_professional_link_state`.');
reset role;

select test_helpers.claims_for((select sa from f406), false, 'staff_admin');
set local role authenticated;
select throws_ok(
  format($$ select public.set_professional_link_state(%L, 'unknown', null) $$,
         (select unknown_profile from f406p)),
  '42501', null,
  '4.4 ⭐⭐ THE TRANSITION CLOSES THE DOOR BEHIND ITSELF. This is the SAME profile and the SAME '
  'caller as 4.1, which passed — 4.1 moved it off `unknown`, so the staff_admin can no longer '
  'touch it. ⛔ That is the sharpest available statement that the bound reads the ROW rather '
  'than the ARGUMENT: a bound implemented on the requested state, or on the caller''s intent, '
  'would let this through. It also shows the capability is genuinely one-shot per profile — '
  'completing an add, not administering a linkage.');
reset role;

-- ============================================================================
-- §5 — THE FAIL-OPEN TWIN. §4 shows the bound REFUSES; nothing yet shows the suite would
-- notice if it were DELETED. ⛔ Matrix § 12.8.5's "nothing would notice the bound being
-- dropped" is a statement about THIS file, and it stops being true here.
-- ============================================================================

do $mut$
declare
  v_src  text;
  v_new  text;
  -- ⛔ THE WHOLE `if` BLOCK, NOT ITS FIRST CONJUNCT. A first draft cut only
  -- `v_current_link is distinct from 'unknown' and `, which leaves
  -- `if not can_manage_professional(...) then raise` — a STRICTER door that refuses the
  -- staff_admin outright. That mutation would have made 5.1 fail and read as "the twin
  -- works", when in fact it was measuring the opposite direction from the one this section
  -- exists for. A fail-OPEN twin must actually open the door.
  v_cut  constant text :=
    '  if v_current_link is distinct from ''unknown''' || chr(10) ||
    '     and not app.can_manage_professional(v_org, auth.uid()) then' || chr(10) ||
    '    raise exception ''o vínculo deste profissional já está definido; apenas a administração da organização pode alterá-lo''' || chr(10) ||
    '      using errcode = ''42501'';' || chr(10) ||
    '  end if;';
begin
  v_src := pg_get_functiondef('public.set_professional_link_state(uuid, text, uuid)'::regprocedure);
  perform set_config('ae47c.orig_link_door', v_src, false);
  if position(v_cut in v_src) = 0 then
    raise exception '406 §5: the link_state bound was not found VERBATIM — the mutation would be a no-op and the twin would report green.'
      using errcode = 'check_violation';
  end if;
  v_new := replace(v_src, v_cut, '');
  execute v_new;
  if position(v_cut in pg_get_functiondef('public.set_professional_link_state(uuid, text, uuid)'::regprocedure)) <> 0 then
    raise exception '406 §5: the bound SURVIVED the execute — the edit did not land.'
      using errcode = 'check_violation';
  end if;
end $mut$;

select test_helpers.claims_for((select sa from f406), false, 'staff_admin');
set local role authenticated;
select lives_ok(
  format($$ select public.set_professional_link_state(%L, 'linked', %L) $$,
         (select linked_profile from f406p), (select oa from f406)),
  '5.1 ⭐⭐ MUTATION TWIN: with the `unknown` bound neutralized, the staff_admin refused at 4.2 '
  'now WALKS THROUGH the door. ⛔ This is the fail-OPEN direction, and it is the only assertion '
  'in the whole AE4.7c change set that measures it: every other suite this increment touched '
  'measures access being removed, and a removal''s tests cannot see a replacement written too '
  'wide.');
reset role;

do $rst$ begin execute current_setting('ae47c.orig_link_door', true); end $rst$;
select is(
  pg_get_functiondef('public.set_professional_link_state(uuid, text, uuid)'::regprocedure),
  current_setting('ae47c.orig_link_door', true),
  '5.2 RESTORE: the door is byte-identical to its pre-mutation definition. ⛔ pg_proc carries no '
  'mtime, so a harness that left this door open could not be dated from the catalog afterwards.');

select test_helpers.reset_role_and_claims();

select * from finish();
rollback;
