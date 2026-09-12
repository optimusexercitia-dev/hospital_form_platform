-- 422 — AE5-ROLE-CATALOG-COMPAT: ADR 0207 D5 steps 1-4, one section per step.
-- Subject: migration 20261003007430. Unit `AE5-ROLE-CATALOG-COMPAT`.
--
-- ⭐ WRITTEN RED-FIRST, AND THAT IS THE WHOLE POINT OF THE FILE. Every section below was
-- authored and RUN against the PRE-migration catalog before a single line of the migration
-- existed. A keystone green on its first run is a FINDING, never a pass: the surface it
-- claims to test does not exist yet, so something else is satisfying it. The run log in
-- `docs/progress/ae5-role-catalog-compat.md` records which sections were red and which were
-- green-by-design (§5 only — see its header).
--
-- ⛔⛔ EVERY BEHAVIOURAL CALL KEYS THE SIGNATURE EXPLICITLY, `public.assume_role(<x>::text)`,
-- AND THE `::text` IS LOAD-BEARING. Before the migration `assume_role` took `platform_role`,
-- and an UNTYPED literal — `public.assume_role('staff_admin')` — coerces to that enum and
-- reaches the OLD door. A suite written that way would have been green before the migration
-- and green after it, proving only that some door exists. With `::text` the pre-migration
-- call raises 42883 (text does not implicitly cast to an enum), which is the red this file
-- was built to observe. ⛔ Do not "simplify" the casts away.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()`: like 408 it needs the real seeded
-- personas (chefe.ccih = staff_admin of CCIH, orgadmin.a = org_admin, platform =
-- profiles.is_admin), and bootstrap's `truncate … cascade` would destroy them. Everything
-- rolls back.
--
-- ⚠ assume_role requires a `session_id` claim, which test_helpers.claims_for does NOT set —
-- the claims blob is built inline (315/408's pattern) and re-set before every call, because
-- each call must run as its own subject.
--
-- ⛔ THE SAVEPOINT TRAP (LESSONS; 421's header states the mechanism): a pgTAP assertion that
-- RAISES inside a savepoint is recovered by the following `rollback to savepoint` and
-- silently never runs, and its TAP line never reaches pg_prove. §4's planted-row
-- discrimination therefore asserts NOTHING inside its savepoint: the measurement leaves the
-- savepoint on a channel a rollback cannot reach — `setval` on a temp sequence, which is
-- NON-transactional — and the assertion is made afterwards, outside. The counter is seeded
-- to 0 = THE BLOCK NEVER RAN and written as `value + 1`, so "the probe did not run" stays a
-- different reading from "the probe found nothing". ⛔ Do not tidy the +1 away.
--
-- RUN SHAPE: `Files=2, Tests=29` (28 here + 00_setup.sql's one). ⛔ Keep this line in step
-- with plan().

begin;
select plan(28);

-- ============================================================================
-- §0 — FIXTURE.
-- ============================================================================
create temp table f422 on commit drop as
  select (select id from public.profiles where email = 'chefe.ccih@test.local')  as sa_uid,
         (select id from public.profiles where email = 'orgadmin.a@test.local')  as oa_uid,
         (select id from public.profiles where email = 'platform@test.local')    as pa_uid,
         (select id from public.commissions order by id limit 1)                 as any_commission;

select is(
  (select count(*)::int from f422
    where sa_uid is not null and oa_uid is not null and pa_uid is not null
      and any_commission is not null),
  1,
  '0.1 FIXTURE CONTROL: the three subject personas and a commission resolve. ⛔ A NULL uid '
  'denies for the wrong reason and asserts nothing (authz-handoff §7.2 case 4 — a plausible '
  'name is not a role).');

-- the counter §4.4 reads. Created BEFORE the savepoint so it survives the rollback.
create temp sequence s422_plant_probe minvalue 0 start 0;
select setval('s422_plant_probe', 0);

-- ============================================================================
-- §1 — AC-1 / STEP 1: `app.active_role_selections.role` is catalog-validated TEXT.
-- ============================================================================

select is(
  (select format_type(a.atttypid, a.atttypmod)
     from pg_attribute a
    where a.attrelid = 'app.active_role_selections'::regclass
      and a.attname = 'role' and a.attnum > 0 and not a.attisdropped),
  'text',
  '1.1 the column is `text`, not the enum. RED before the migration (it read `platform_role`).');

select is(
  (select count(*)::int
     from pg_constraint c
    where c.conrelid = 'app.active_role_selections'::regclass
      and c.contype = 'f'
      and c.confrelid = 'authz.roles'::regclass
      and c.confupdtype = 'a' and c.confdeltype = 'a'
      and (select a.attname from pg_attribute a
            where a.attrelid = c.conrelid and a.attnum = c.conkey[1]) = 'role'),
  1,
  '1.2 …and it carries an FK to authz.roles, on NO ACTION in both directions (RESTRICT '
  'semantics, matching memberships_role_scope_kind_fkey). ⚠ OPERATIONAL CONSEQUENCE, stated '
  'because it is new: a role code held by a LIVE session selection can no longer be deleted '
  'from the catalog — 408 §4 clears the selection rows first, as fixture cleanup.');

select throws_ok(
  format($$ insert into app.active_role_selections (session_id, user_id, role, chosen_at)
            values (gen_random_uuid(), %L, 'zzz_not_a_role', now()) $$,
         (select pa_uid from f422)),
  '23503', null,
  '1.3 ⭐ a role code the CATALOG does not carry is refused by the FK — 23503 specifically. '
  'Before the migration the same insert raised 22P02 (invalid enum input): a different '
  'mechanism, a different sqlstate, and the reason this asserts the code rather than merely '
  '"it fails".');

select lives_ok(
  format($$ insert into app.active_role_selections (session_id, user_id, role, chosen_at)
            values (gen_random_uuid(), %L, 'staff_admin', now()) $$,
         (select pa_uid from f422)),
  '1.4 ⭐ DISCRIMINATION HALF: a code the catalog DOES carry still inserts. Without this, a '
  'column that rejected every value — a broken FK, a typo''d target — would satisfy 1.3 '
  'exactly as well as a correct one.');

-- ============================================================================
-- §2 — AC-2 / STEP 2: ONE non-overloaded `public.assume_role(text)`, and BOTH halves of its
-- gate. §2.1-2.4 are the shape; §2.5-2.10 are behaviour, each a mutation or its control.
--
-- ⛔ `to_regprocedure` rather than a direct cast throughout: it returns NULL for an absent
-- routine instead of RAISING, so the pre-migration run REDS these assertions rather than
-- aborting the file and taking every later section's verdict with it.
-- ============================================================================

select is(
  (select count(*)::int::text || '/' ||
          coalesce(string_agg(pg_get_function_arguments(p.oid), ';' order by p.oid), '(none)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assume_role'),
  '1/p_role text',
  '2.1 ⭐ EXACTLY ONE routine named assume_role, and its argument is `p_role text`. ⛔ The '
  'count and the signature are asserted as ONE string on purpose: a count of 1 alone was '
  'already true before the migration (the enum door), and a leftover overload beside the new '
  'door would leave the count at 2 with the text signature present — each fact alone passes '
  'in a state the pair refuses.');

select ok(
  (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.assume_role(text)')),
  '2.2 …and it is SECURITY DEFINER, which is the only reason its read of the sealed `authz` '
  'schema needs no grant. ⛔ prosecdef from pg_proc, never inferred from a migration''s text.');

select is(
  (select p.proconfig from pg_proc p where p.oid = to_regprocedure('public.assume_role(text)')),
  array['search_path=""'],
  '2.3 ⭐⭐ ADR 0208 D4: a NEW SECURITY DEFINER lands on `set search_path = ''''` — the EMPTY '
  'form, asserted as the exact proconfig array and not as "contains search_path". The sibling '
  'clause (a schema-qualified body) is 421''s, over this door''s new membership in the '
  'empty-path population; 419 ratchets the non-empty set this door LEAVES.');

select is(
  (select (p.proacl is not null)::text
          || '/' || (exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))::text
          || '/' || coalesce((select string_agg(distinct a.grantee::regrole::text, ',' order by a.grantee::regrole::text)
                                from aclexplode(p.proacl) a where a.privilege_type = 'EXECUTE'), '(none)')
     from pg_proc p where p.oid = to_regprocedure('public.assume_role(text)')),
  'true/false/authenticated,postgres,service_role',
  '2.4 ⭐ THE ACL IS RE-ISSUED, NOT INHERITED. Three parts, because the first is what makes '
  'the second readable: (a) proacl is NOT NULL — ⛔ a NULL proacl means the DEFAULT, which '
  'INCLUDES PUBLIC, so a probe that only looked for a PUBLIC entry would report "PUBLIC '
  'absent" about a function PUBLIC can execute (LESSONS: guards that read right but fail '
  'open); (b) no grantee 0 (PUBLIC) entry survives the revoke; (c) EXECUTE is held by exactly '
  'authenticated, service_role and the owner.');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f422), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('staff_admin'::text) $$,
  '2.5 BASELINE: chefe.ccih, who genuinely holds a live staff_admin membership, seats it. ⛔ '
  'Without this every denial below could be attributable to a fixture that never worked.');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f422), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select throws_ok($$ select public.assume_role('org_admin'::text) $$,
  '42501', 'papel não disponível para este usuário',
  '2.6 ⭐⭐ THE REAL-ASSIGNMENT HALF, WHICH 408 DOES NOT TEST: a caller holding role A is '
  'refused role B outright. `org_admin` is session_selectable and its catalog row is present, '
  'so the ONLY thing denying here is the memberships lookup. ⛔ The message is asserted, not '
  'just the sqlstate: the session_selectable denial carries the SAME 42501 under a DIFFERENT '
  'message, so an errcode-only assertion would pass if the selectability gate had fired '
  'instead and this half were absent.');
reset role;

update public.memberships set expires_at = now() - interval '1 day'
 where principal_id = (select sa_uid from f422) and role = 'staff_admin';

select cmp_ok(
  (select count(*)::int from public.memberships
    where principal_id = (select sa_uid from f422) and role = 'staff_admin'
      and (expires_at is null or expires_at > now())), '=', 0,
  '2.7 ⛔ THE MUTATION LANDED: chefe.ccih holds no LIVE staff_admin row. A mutation that did '
  'not fully apply reports GREEN downstream — assert the edit, then the effect. ⚠ EXPIRY, not '
  'DELETE: a delete would cascade into rows referencing the membership, and the denial would '
  'then be attributable to collateral damage rather than to the assignment gate.');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f422), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select throws_ok($$ select public.assume_role('staff_admin'::text) $$,
  '42501', 'papel não disponível para este usuário',
  '2.8 ⭐⭐ …and the role she DID hold is now refused too, by the same gate. Together with 2.5 '
  'this is the mutation''s before/after pair: the identical call lived at 2.5 and dies here, '
  'and the only thing that changed is the membership''s liveness.');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select oa_uid from f422), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('org_admin'::text) $$,
  '2.9 ⭐⭐ THE DISCRIMINATION HALF: an untouched sibling STILL SEATS while chefe.ccih cannot. '
  '⛔ Not optional — a door that is simply broken (wrong column, always-false, a body that '
  'raises unconditionally) satisfies 2.6 and 2.8 perfectly, and only a caller who still gets '
  'through separates a wired gate from a dead one.');
reset role;

update public.memberships set expires_at = null
 where principal_id = (select sa_uid from f422) and role = 'staff_admin';

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f422), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('staff_admin'::text) $$,
  '2.10 ⛔ THE RESTORE IS PROVEN: un-expiring the row makes the role seatable again. A '
  'one-way latch — a door that broke on the first UPDATE and never recovered — would satisfy '
  '2.8 and fail here.');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f422), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select throws_ok($$ select public.assume_role('zzz_not_a_role'::text) $$,
  '42501', 'papel não selecionável nesta sessão',
  '2.11 ⭐ FAIL CLOSED ON AN UNKNOWN CODE, AND AT THE RIGHT LAYER. With a text parameter the '
  'enum no longer rejects a stranger for free, so the door must. ⛔ 42501 and the '
  'selectability message specifically — NOT 23503: a code that reached the '
  '`active_role_selections` INSERT and was refused there by §1.2''s FK would mean the '
  'catalog check had been skipped and an unauthorized seating attempt got as far as a write.');
reset role;

-- ============================================================================
-- §3 — AC-3 / STEP 3: the enum is gone.
--
-- ⛔ STATED BOUND: "its pg_depend dependents were ZERO BEFORE the drop" is NOT assertable
-- here — after the type is gone `to_regtype` is NULL and every dependent probe keyed on it
-- returns 0 VACUOUSLY. That claim is enforced where it can be: the migration's own DO block
-- raises if any non-internal dependent survives, so the drop cannot proceed past one. What
-- this section asserts is the post-state, with a control that the probe is alive.
-- ============================================================================

select is(
  coalesce(to_regtype('public.platform_role')::text, '(absent)'),
  '(absent)',
  '3.1 the `platform_role` enum no longer exists.');

select is(
  coalesce(to_regtype('authz.scope_kind')::text, '(absent)'),
  'authz.scope_kind',
  '3.2 ⭐ INSTRUMENT CONTROL for 3.1: `to_regtype` still RESOLVES a type that is present. '
  '⛔ Without this, 3.1 is satisfied by a probe that returns NULL for everything — a '
  'misspelled schema, a lookup run under the wrong search_path — exactly as well as by a '
  'genuinely dropped type.');

-- ============================================================================
-- §4 — AC-4 / STEP 4: the row leaves, the domain tightens, and the memberships proof that
-- had to precede the tightening.
-- ============================================================================

select is(
  (select count(*)::int::text || '/' ||
          coalesce((select string_agg(code, ',') from authz.roles where code = 'administrativo'), '(absent)')
     from authz.roles),
  '11/(absent)',
  '4.1 eleven catalog rows, and `administrativo` is not among them. ⛔ Asserted as a PAIR: '
  'the count alone would be satisfied by a catalog that dropped some other role and kept the '
  'capability-plane row, which is the one outcome step 4 exists to prevent.');

select is(
  (select array_agg(m[1] order by m[1])
     from pg_constraint c,
          lateral regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''::text', 'g') m
    where c.contypid = 'authz.scope_kind'::regtype and c.contype = 'c'),
  array['commission','hospital','none','organization'],
  '4.2 ⭐ the `authz.scope_kind` DOMAIN declares exactly the four reachable kinds. Read from '
  'the live constraint definition, never from a migration''s text. ⚠ If the domain is ever '
  'redefined as an enum this returns NULL and reds loudly rather than passing empty.');

select is(
  (select count(*)::int from public.memberships where scope_kind::text = 'capability_plane'),
  0,
  '4.3 ⭐⭐ THE MEMBERSHIPS PROOF ADR 0207 D5 ORDERS BEFORE THE TIGHTENING: no membership row '
  'carries `capability_plane`. ⛔ Measured, never inherited — `memberships_role_check` '
  'structurally admits only ten codes today, but a CHECK can be altered, so the proof is a '
  'cell and not an assumption. 4.4 is what makes this 0 mean something.');

savepoint plant_capability_plane;

do $$
declare
  v_uid uuid := (select pa_uid from f422);
  v_comm uuid := (select any_commission from f422);
begin
  -- Drop, inside this savepoint only, everything that blocks the plant. THREE things do,
  -- and the third is the one the pre-migration run did not reveal: (1) `scope_kind` is a
  -- GENERATED ALWAYS column whose expression can emit only commission|hospital|organization|
  -- NULL, so the value is unconstructible until the expression is dropped; (2) the composite
  -- FK (role, scope_kind) -> authz.roles(code, allowed_scope_kind) MATCH FULL would refuse
  -- ('staff','capability_plane') once the administrativo row is gone; (3) AFTER step 4 the
  -- `authz.scope_kind` DOMAIN itself rejects the value with 23514 — so a plant block written
  -- against the pre-migration catalog RAISES here, aborts the transaction, and takes every
  -- later section's verdict with it. All three come back with the rollback, and 4.6 (which
  -- runs after it) is what proves the domain constraint returned.
  -- ⛔ Dropping the domain CHECK here does not weaken 4.6: this block exists to prove 4.3's
  -- MEMBERSHIPS probe can see a planted row, which is a different claim from the domain's.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  alter table public.memberships drop constraint memberships_role_scope_kind_fkey;
  alter table public.memberships alter column scope_kind drop expression;
  alter domain authz.scope_kind drop constraint scope_kind_check;
  insert into public.memberships (principal_id, commission_id, role, scope_kind)
  values (v_uid, v_comm, 'staff', 'capability_plane');

  -- The measurement leaves on the ONE channel `rollback to savepoint` cannot reach.
  -- +1 so that 0 still reads as THE BLOCK NEVER RAN.
  perform setval('s422_plant_probe',
    (select count(*) from public.memberships where scope_kind::text = 'capability_plane') + 1);
end $$;

rollback to savepoint plant_capability_plane;

select is(
  (select last_value::int from s422_plant_probe),
  2,
  '4.4 ⭐⭐ 4.3 RED-FIRST AGAINST A PLANTED ROW — the discrimination without which a 0 is '
  'just a number. With one `capability_plane` membership constructed, 4.3''s exact probe '
  'counts 1 (recorded as 1+1=2), so the cell CAN see the state it claims is absent. ⛔ A '
  'value of 0 here would mean the plant block NEVER RAN — a different and worse reading than '
  '"found nothing", which is why the counter is written as value+1. ⛔ And the assertion is '
  'made HERE, outside the savepoint: a pgTAP call inside it would have been recovered by the '
  'rollback and its TAP line would never have been emitted.');

select is(
  (select count(*)::int from public.memberships where scope_kind::text = 'capability_plane'),
  0,
  '4.5 ⛔ THE PLANT IS GONE and the generated expression plus the composite FK are back — so '
  '4.3 measured the catalog''s real state and not a fixture this file left behind, and no '
  'later section inherits a mutated memberships table.');

select throws_ok(
  $$ select 'capability_plane'::authz.scope_kind $$,
  '23514', null,
  '4.6 ⭐ AFTER THE TIGHTENING the domain itself REFUSES `capability_plane` — 23514, a CHECK '
  'violation, asked of the domain directly. ⚠ This is 401 §14.5''s property arriving on the '
  'other domain: `authz.resolution_scope_kind` already rejected the value while '
  '`authz.scope_kind` admitted it, and that asymmetry is what step 4 removes.');

select lives_ok(
  $$ select 'commission'::authz.scope_kind $$,
  '4.7 ⭐ DISCRIMINATION HALF for 4.6: a kind the domain DOES declare still casts. Without '
  'it, a domain whose CHECK rejected everything — a malformed re-add, a constraint on the '
  'wrong expression — would satisfy 4.6 exactly as well as a correct one.');

select is(
  (select array_agg(distinct role_code order by role_code) from authz.role_permissions),
  array['staff_admin'],
  '4.8 ⛔ `authz.role_permissions` IS UNTOUCHED: still exactly one granting role. ADR 0207 D5 '
  'step 4 deletes a ROLE ROW and nothing else; a delete that had cascaded into the permission '
  'grants would be a silent scope change, and the FK that made the row deletable (zero '
  'dependents) is what this re-measures from the other side.');

-- ============================================================================
-- §5 — AC-7: STEP 6 WAS NOT TAKEN, PROVEN BY PIN.
--
-- ⚠ THIS SECTION IS EXPECTED GREEN ON ITS FIRST RUN AND THAT IS NOT THE USUAL FINDING. Its
-- claim is INVARIANCE — "these two bodies are byte-identical before and after the migration"
-- — so a green before the migration is half the measurement, not a vacuous pass. The values
-- are the ones measured at the unit's opening (`docs/progress/ae5-role-catalog-compat.md`)
-- and re-measured at build; if either moves, step 6 was taken and the unit exceeded its
-- ADR 0207 D5 scope.
-- ============================================================================

select is(
  md5(pg_get_functiondef('app.member_can(uuid,text)'::regprocedure)),
  '25c6747df0c01a34a6783f8a25c8dbd4',
  '5.1 ⛔ `app.member_can(uuid,text)` is byte-unchanged. The capability plane''s behaviour is '
  'proposed-order item 6''s and is explicitly OUT of this unit (ADR 0207 D5 step 6, D7).');

select is(
  md5(pg_get_functiondef('app.member_can_for(uuid,text,uuid)'::regprocedure)),
  'da9b5b9bdac1a45cb4deed23ef4a3d27',
  '5.2 ⛔ …and so is `app.member_can_for(uuid,text,uuid)`, the subject-keyed twin ADR 0134 '
  'Amdt 6 added. ⚠ BOTH are pinned because a change to one is not a change to the other: '
  '`app._case_caps`'' S8 arm calls only the `_for` form, so a mapping bolted onto that twin '
  'alone would leave 5.1 green.');

select * from finish();
rollback;
