-- 418 — ADMIN-ARM-IS-ACTIVE (pre-AE5 remediation Batch 10). The admin arm follows the
-- SUBJECT'S ACCOUNT STATE at all three sites, and the `platform_admin` Class-2 write arm is
-- removed from the professional registry and relocated to the vocabulary gate.
--
-- Subject: the migration `20261003007390_admin_arm_follows_account_state.sql`, built on ADR
-- 0201 D4 (three `is_active` sites — Batch 9 rulings R3 + R12) and D5 (the Class-2 arm — R4),
-- plus the R10 audit-stamp ruling. Written RED-FIRST against head pair (20261003007380, 527).
--
-- ⛔⛔ WHAT THIS SUITE IS FOR. At head, a `platform_admin` whose `public.profiles` row says
-- `is_active = false` (or `suspended_until > now()`) still passed EVERY admin arm in the tree:
--
--     app.is_admin()          v_is_admin AND active_role() = 'platform_admin'   -- no state term
--     app.is_admin_for(uuid)  exists(profiles.is_admin) AND (third-party OR hat) -- no state term
--     public.assume_role()    exists(profiles.is_admin)                          -- no state term
--
-- The third is the seating door: gating the two predicates while leaving the door that MINTS
-- the hat ungated would READ complete while a deactivated admin put the hat back on. PO ruling
-- R1 took the gate DOOR-WIDE (every tier, not only the platform branch) as a declared widening
-- of R12 — §3 carries the tenant-tier cell that widening owes.
--
-- ⚠ DEACTIVATED AND SUSPENDED ARE FOLDED, DELIBERATELY, AND NO CELL CLAIMS OTHERWISE.
-- `app.is_active(p)` is `is_active AND (suspended_until IS NULL OR now() >= suspended_until)`
-- — one boolean. `401 § 16.4` already records why a matrix cell expecting a DISTINGUISHABLE
-- answer would assert something the system cannot express. Every pair below therefore tests
-- BOTH states and asserts the SAME answer; the two are separate cells because the two COLUMNS
-- are separately writable, not because the predicate can tell them apart.
--
-- ⚠ EVERY `update public.profiles` IS PRECEDED BY `set_config('request.jwt.claims','',true)`.
-- `guard_profile_privileged_columns` takes its trusted-caller return only when `auth.uid()` is
-- NULL; with claims still seated the update raises. This is the `328:477-490` dialect, adopted
-- verbatim, and it is load-bearing rather than tidy.
--
-- ⚠ `claims_for` FIRST, `set local role authenticated` SECOND — `00_setup.sql`'s own header
-- records the suites that reversed it and denied vacuously for a whole file.
--
-- ⚠ THE `assume_role` CELLS BUILD THEIR CLAIMS BY HAND. `test_helpers.claims_for` mints
-- `sub`/`role`/`is_admin`/`active_role` but NOT `session_id`, and `assume_role` raises `28000`
-- without one. §3 uses the `315`/`408` idiom (`set_config` + `jsonb_build_object`) instead.
--
-- RUN SHAPE: `Files=2, Tests=31` (30 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a
-- count mismatch.

begin;
select plan(30);

update app.feature_flags set enabled = true
  where key in ('ethics', 'case_participants', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid as admin,
         (v->>'sa_x')::uuid  as sa_x,
         (v->>'oa_b')::uuid  as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- §4's subject: a professional profile in the bootstrap org that is NEITHER retention-pinned
-- NOR a respondent in an issued decision, so `redact_professional_profile` reaches its
-- AUTHORITY check and never its HC0J7 bar. (257 owns the bar; this file owns the authority.)
insert into public.professional_profiles (id, organization_id, full_name)
  select 'fb000000-0000-0000-0000-000000000418', (select org_x from k), '418 Sujeito Registro';

-- ============================================================================
-- §0 — PRECONDITIONS. Asserted, never claimed (authz-handoff §7.3). Each one is the reason
-- some ⭐ cell below is attributable at all.
-- ============================================================================

select is((select count(*)::int from public.profiles
            where id in (select admin from k union all select sa_x from k
                         union all select oa_b from k)
              and is_admin = true), 1,
  '0.1 ⭐⭐ EXACTLY ONE of the three personas carries `profiles.is_admin = true`, and it is '
  '`admin`. ⛔ NOT BOOKKEEPING: `test_helpers.claims_for(u, p_is_admin, …)` takes `p_is_admin` '
  'as an ARGUMENT and never reads `profiles`, so a fixture may mint a claim that DISAGREES '
  'with the row. `app.is_admin()` trusts the claim; `app.is_admin_for()` and `app.is_active()` '
  'read `profiles`. A divergent principal would flip every ⭐ cell for a FIXTURE reason and it '
  'would read exactly like a real defect.');

select ok(app.is_active((select admin from k))
          and app.is_active((select sa_x from k))
          and app.is_active((select oa_b from k)),
  '0.2 ⭐ THE BASELINE THE MUTATIONS MOVE: all three personas are ACTIVE at fixture time. '
  '⛔ Without this every "…is now denied" cell below could be denied by a state that was '
  'already false, and the deactivations would be measuring nothing.');

select ok(exists (select 1 from public.memberships m
                   where m.principal_id = (select oa_b from k) and m.role = 'org_admin'
                     and m.organization_id = (select org_x from k))
          and not exists (select 1 from public.memberships m
                           where m.principal_id = (select admin from k)
                             and m.organization_id = (select org_x from k)),
  '0.3 ⭐ THE AUTHORITY IS LOCATED, AND ITS ABSENCE TOO: `oa_b` holds `org_admin` at the org '
  'that owns `comm_x`, and `admin` holds NO membership there at all. §4''s ⭐ denials are then '
  'attributable to the REMOVED platform arm — the org arm was never open to `admin` (Rule 13: '
  'an affiliation LOCATES, a `memberships` row GRANTS).');

select ok(app.feature_enabled('audit_trail') and app.feature_enabled('ethics')
          and app.feature_enabled('case_participants'),
  '0.4 ⭐⭐ THE FLAGS, ASSERTED RATHER THAN ASSUMED — and `audit_trail` is the load-bearing '
  'one. `app.audit_write` RETURNS EARLY when it is off, so §3.5''s "a DENIED assumption writes '
  'no audit row" would then be measuring the FLAG, not the door. A flag''s `description` is '
  'prose; only `enabled` is the flag.');

-- ============================================================================
-- §1 — SITE 1: `app.is_admin()`. CALLER-KEYED, so the mutation is on the CALLER'S OWN row.
-- ============================================================================

select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select ok(app.is_admin(),
  '1.1 ⭐ DISCRIMINATION, AND IT RUNS FIRST ON PURPOSE: the ACTIVE, admin-flagged, '
  'platform_admin-hatted caller passes. Green BEFORE and AFTER. ⛔ Without it 1.2/1.3 are '
  'equally well satisfied by a predicate that denies everyone — which is what an `is_active` '
  'term that read the wrong row would produce.');
reset role;

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select admin from k);
select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select ok(not app.is_admin(),
  '1.2 ⭐⭐ DEACTIVATED (`is_active = false`): the SAME caller, the SAME hat, the SAME '
  '`is_admin` claim — and `app.is_admin()` now denies. RED at head (20261003007380): the body '
  'was `claim-or-profile-flag AND hat`, with no account-state term, so a deactivated '
  'platform_admin passed 26 policies and 13 functions. ⚠ This cell does NOT claim to '
  'distinguish deactivation from suspension: `app.is_active` FOLDS them (401 § 16.4) and 1.3 '
  'asserts the SAME answer for the other column deliberately.');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select admin from k);

update public.profiles set suspended_until = now() + interval '7 days' where id = (select admin from k);
select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select ok(not app.is_admin(),
  '1.3 ⭐⭐ SUSPENDED (`suspended_until > now()`), the OTHER column, the SAME answer. RED at '
  'head for the same reason as 1.2. ⛔ The two cells exist because the two COLUMNS are '
  'separately writable, NOT because the predicate can tell them apart — `app.is_active` '
  'returns one boolean and no cell here pretends otherwise.');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set suspended_until = null where id = (select admin from k);

-- ⛔ THE CLAIMS ARE MINTED BY HAND HERE, AND THE REASON IS A MEASURED FIXTURE TRAP.
-- `test_helpers.claims_for(u, true)` with `p_active_role` omitted does NOT leave the caller
-- hatless: `00_setup.sql:418-431` unions `'platform_admin' where p_is_admin` with the live
-- memberships and, when the union has exactly ONE member, MINTS that hat. `admin` holds no
-- membership, so the union is exactly {platform_admin} and the "hatless" fixture arrives
-- WEARING the hat. Written that way first, this cell went RED at head for a FIXTURE reason
-- while reading like a predicate one — the wrong-arm fixture shape, caught by the cell's own
-- expected-green polarity (2026-09-10, recorded in the unit's session log).
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'role', 'authenticated',
                     'is_admin', true)::text, true);
set local role authenticated;
select ok(not app.is_admin(),
  '1.4 ⭐ NEGATIVE CONTROL — THE D11 HAT CONJUNCT WAS NOT COLLATERALLY REMOVED. An ACTIVE, '
  'admin-flagged caller with NO `active_role` claim at all is still denied. Green BEFORE and '
  'AFTER. ⛔ A `create or replace` that added `app.is_active` while dropping '
  '`app.active_role() is not distinct from ''platform_admin''` would satisfy 1.1-1.3 and '
  'silently WIDEN the gate; this is the cell that reds on it. ⚠ See the comment above for why '
  'the claims are hand-minted — `claims_for(u, true)` cannot express "hatless" for this '
  'principal.');
reset role;
select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- §2 — SITE 2: `app.is_admin_for(uuid)`. SUBJECT-KEYED, so the mutation is on the SUBJECT'S
-- row and the caller is a THIRD PARTY — which satisfies the D11 hat clause by construction
-- (`p_user_id is distinct from auth.uid()`) and isolates the account-state term.
-- ============================================================================

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select ok(app.is_admin_for((select admin from k)),
  '2.1 ⭐ DISCRIMINATION FIRST, same discipline as 1.1: a non-admin third party (`sa_x`, a '
  'commission staff_admin) asks about the ACTIVE admin and gets TRUE. Green BEFORE and AFTER. '
  '⛔ It also pins the third-party clause (ADR 0106 D11): the asker''s own hat must never '
  'change what the system concludes about ANOTHER principal.');
reset role;

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select admin from k);
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select ok(not app.is_admin_for((select admin from k)),
  '2.2 ⭐⭐ SUBJECT DEACTIVATED: the SAME third-party caller asks about the SAME subject and is '
  'now told FALSE. RED at head — the body was `exists(profiles.is_admin) AND (third-party OR '
  'hat)`, and neither conjunct reads account state, so a deactivated admin stayed an admin to '
  'every one of `is_admin_for`''s five callers. ⭐ The new term is `app.is_active(p_user_id)` — '
  'SUBJECT-keyed, matching its siblings; a caller-keyed arm here would answer about `sa_x` '
  '(ADR 0193 D5 / 0201 D3).');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select admin from k);

update public.profiles set suspended_until = now() + interval '7 days' where id = (select admin from k);
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select ok(not app.is_admin_for((select admin from k)),
  '2.3 ⭐⭐ SUBJECT SUSPENDED — the other column, the same answer, RED at head. Paired with 2.2 '
  'for the reason 1.3 is paired with 1.2, and claiming no more than that.');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set suspended_until = null where id = (select admin from k);

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select admin from k);
select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select ok(not app.is_admin_for((select admin from k)),
  '2.4 ⭐⭐ THE SELF HALF: caller = subject = `admin`, deactivated, HAT ON. RED at head. This '
  'is the arm 2.2 cannot reach — with caller and subject identical the third-party clause is '
  'FALSE and the answer comes through the hat clause instead, so without this cell the '
  'caller-keyed path through `is_admin_for` stays unproven and one arm could carry the other.');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select admin from k);

-- ============================================================================
-- §3 — SITE 3: `public.assume_role`, THE SEATING DOOR. Differential, `328`'s shape.
-- ⭐ PO ruling R1 put the gate DOOR-WIDE — before ANY seating, after the `session_selectable`
-- check (which keeps the more specific "not selectable" answer for a role nobody may pick).
-- 3.8/3.9 are the TENANT-TIER pair that widening owes: without them the widening is asserted
-- by nothing and the door would read gated while only its platform branch was.
-- ============================================================================

create temp table sid1 on commit drop as select gen_random_uuid() as v;
create temp table sid2 on commit drop as select gen_random_uuid() as v;
create temp table sid3 on commit drop as select gen_random_uuid() as v;
create temp table sid4 on commit drop as select gen_random_uuid() as v;
create temp table sid5 on commit drop as select gen_random_uuid() as v;

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select admin from k);
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'role', 'authenticated',
                     'session_id', (select v from sid1))::text, true);
set local role authenticated;
select throws_ok(
  $$ select public.assume_role('platform_admin'::public.platform_role) $$,
  '42501', null,
  '3.1 ⭐⭐ THE SEATING DOOR, DEACTIVATED: a deactivated admin-flagged principal may no longer '
  'MINT the platform_admin hat. RED at head — the platform branch tested `profiles.is_admin` '
  'alone, so the call SUCCEEDED and the deactivated principal walked away wearing the hat that '
  '§1 and §2 are about. ⛔ Gating the two predicates and not this door would have read '
  'complete while leaving the hole open one level up (ADR 0201 D4, ruling R12).');
reset role;

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select admin from k);
update public.profiles set suspended_until = now() + interval '7 days' where id = (select admin from k);
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'role', 'authenticated',
                     'session_id', (select v from sid2))::text, true);
set local role authenticated;
select throws_ok(
  $$ select public.assume_role('platform_admin'::public.platform_role) $$,
  '42501', null,
  '3.2 ⭐⭐ THE SEATING DOOR, SUSPENDED — the other column, the same 42501, RED at head. ⚠ The '
  'errcode is load-bearing: `28000` would be the authentication/session guards standing in '
  'front, and `42501` is the authority raise this cell claims.');
reset role;

select set_config('request.jwt.claims', '', true);
update public.profiles set suspended_until = null where id = (select admin from k);
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'role', 'authenticated',
                     'session_id', (select v from sid3))::text, true);
set local role authenticated;
select lives_ok(
  $$ select public.assume_role('platform_admin'::public.platform_role) $$,
  '3.3 ⭐⭐ THE DIFFERENTIAL HALF: the SAME principal, re-activated, making the SAME call, is '
  'seated. Green BEFORE and AFTER. ⛔ Without it 3.1/3.2 are satisfied by a door that refuses '
  'everyone — and a door refusing everyone is exactly what a mis-keyed `is_active` argument '
  'would produce.');
reset role;

select is((select count(*)::int from app.active_role_selections where session_id = (select v from sid1)), 0,
  '3.4 ⭐⭐ NO SEATING FOR THE DENIED SESSION. RED at head: today a row IS written for 3.1''s '
  'session, because the deny does not exist yet. The gate is placed BEFORE the '
  '`insert into app.active_role_selections`, so a refusal must leave no selection behind.');

select is((select count(*)::int from public.audit_log
            where action = 'active_role.assumed' and entity_id = (select v from sid1)), 0,
  '3.5 ⭐⭐ AND NO AUDIT ROW FOR IT. RED at head, and it mirrors `315:199-202`''s own claim '
  '("a DENIED assumption must not be audited"). ⚠ 0.4 is what makes this readable: with '
  '`audit_trail` off, `app.audit_write` returns early and this zero would be the FLAG.');

select is((select count(*)::int from app.active_role_selections where session_id = (select v from sid3)), 1,
  '3.6 ⭐⭐ DISCRIMINATION FOR 3.4 — THE INSTRUMENT IS ALIVE: the PERMITTED session of 3.3 DID '
  'seat a row. Green before and after. ⛔ Without it, 3.4''s zero is equally explained by a '
  'query that can never see a row (wrong table, wrong column, wrong session id) — a negative '
  'control cannot see a dead instrument.');

select is((select count(*)::int from public.audit_log
            where action = 'active_role.assumed' and entity_id = (select v from sid3)), 1,
  '3.7 ⭐⭐ DISCRIMINATION FOR 3.5, same argument: the PERMITTED assumption DID write exactly '
  'one `active_role.assumed` row. Green before and after.');

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select sa_x from k);
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_x from k), 'role', 'authenticated',
                     'session_id', (select v from sid4))::text, true);
set local role authenticated;
select throws_ok(
  $$ select public.assume_role('staff_admin'::public.platform_role) $$,
  '42501', null,
  '3.8 ⭐⭐ THE DECLARED WIDENING''S OWN CELL (PO ruling R1). A deactivated COMMISSION '
  'staff_admin cannot seat a tenant hat either. RED at head. ⛔ This is what makes R1 a '
  'ruling rather than a preference: variant (B) would have gated the platform branch only, '
  'reproducing INSIDE ONE BODY the shape R12 was taken to remove — a door that reads gated. '
  'Authority-neutral by measurement: every tenant predicate already carries `app.is_active`, '
  'so what this removes is a pointless seating and its audit row, never an ability.');
reset role;

select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select sa_x from k);
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_x from k), 'role', 'authenticated',
                     'session_id', (select v from sid5))::text, true);
set local role authenticated;
select lives_ok(
  $$ select public.assume_role('staff_admin'::public.platform_role) $$,
  '3.9 ⭐ DISCRIMINATION FOR 3.8: the same tenant principal, re-activated, is seated. Green '
  'before and after — the widening must not have closed the tenant tier outright.');
reset role;
select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- §4 — THE CLASS-2 WRITE ARM (ADR 0201 D5 / Batch 9 ruling R4). `platform_admin` LOSES the
-- professional registry and KEEPS case vocabulary, and the reason is the surviving one:
-- A35's noun list is *tenancy, identity, VOCABULARY and audit* — a tenant's professional
-- REGISTRY is Class-2 tenant content, the user DIRECTORY is the "identity" noun.
-- ⛔ The relocation is not tidying: a bare removal strands vocabulary with 42501, which is
-- what 4.8 is here to catch.
-- ============================================================================

select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select ok(app.is_admin() and app.is_active((select admin from k)),
  '4.0 ⭐⭐ §4''s ATTRIBUTABILITY PRECONDITION, and it is not decoration. Every ⭐ denial below '
  'must be caused by the REMOVED ARM, so the actor is re-asserted ACTIVE and HATTED at §4 '
  'entry — §§1-3 deactivated this very principal five times. ⛔ Without it, a leaked '
  '`is_active = false` would make 4.1/4.7/4.8 pass AFTER the migration for the §1 reason '
  'instead of the D5 one, and the D5 half would be proven by nothing.');
reset role;

select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('fb000000-0000-0000-0000-000000000418', 'motivo') $$,
  '42501', null,
  '4.1 ⭐⭐ THE CLASS-2 DENIAL. An ACTIVE, hatted `platform_admin` may NOT redact a tenant''s '
  'professional profile. RED at head — `app.can_manage_professional`''s first arm was '
  '`app.is_admin_for(p_uid)` and the caller IS the subject, so it granted. ⛔ 42501 is the '
  'AUTHORITY raise; `HC0J7` would be the retention bar (257''s subject) and `HC000` the '
  'feature flag, so the code is what separates this claim from those two files''.');
reset role;

select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  $$ select public.redact_professional_profile('fb000000-0000-0000-0000-000000000418', 'pedido do titular') $$,
  '4.2 ⭐⭐ DISCRIMINATION FOR 4.1: the ORG_ADMIN of that org redacts the same profile. Green '
  'before AND after. ⛔ Without it 4.1 is equally well explained by a door that is broken '
  'shut, and D5 would have removed an arm while nobody could see the door still opens.');
reset role;

select ok(has_function_privilege('authenticated', 'public.redact_professional_profile(uuid,text)', 'EXECUTE')
          and (select prosecdef from pg_proc
                where oid = 'public.redact_professional_profile(uuid,text)'::regprocedure),
  '4.3 ⭐ THE REACHABILITY PREMISE, ASSERTED RATHER THAN CLAIMED: the door is EXECUTE-granted '
  'to `authenticated` and is its OWN gate (`prosecdef`), so 4.1 is a statement about a '
  'reachable surface. ⛔ What pgTAP CANNOT see is stated instead of implied: the HTTP hop and '
  'PostgREST''s `db-schemas` config are NOT provable from inside a DB session, so this suite '
  'claims "the EXECUTE grant plus the door''s own check", never "the PostgREST path".');

select ok(not has_table_privilege('authenticated', 'public.professional_profiles', 'SELECT')
          and not has_table_privilege('authenticated', 'public.professional_profiles', 'INSERT')
          and not has_table_privilege('authenticated', 'public.professional_profiles', 'UPDATE')
          and not has_table_privilege('authenticated', 'public.professional_profiles', 'DELETE'),
  '4.4 ⭐ NO PARENT PATH: `authenticated` holds none of the four table privileges on '
  '`professional_profiles`, so 4.1''s denial is not defeated by a direct write beside the '
  'door. A write lockdown defeated by its parent is a lockdown in name only.');

select is((select count(*)::int from pg_policies
            where schemaname = 'public' and tablename = 'professional_profiles'), 1,
  '4.5 ⭐ …and the table carries EXACTLY ONE policy (`professional_profiles_select`, RLS '
  'enabled), so no second permissive sibling can supply what 4.4 denies.');

select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select throws_ok(
  format($$ select public.create_professional_profile(%L, '418 Intruso') $$,
         (select org_x from k)),
  '42501', null,
  '4.6 ⭐⭐ A DECLARED LOSS, NAMED (ADR 0201 D5 item 3): `platform_admin` also loses '
  'professional CREATE. RED at head. The reason is D5''s SURVIVING one — the create path '
  'mints `public.participants` rows carrying `sensitivity_class = ''professional_identity''` '
  'and a real name, so a platform arm here would let a platform_admin CREATE Class-2 '
  'professional-identity content inside any tenant''s registry. ⛔ The WITHDRAWN reason ("it '
  'seats a professional INTO A CASE") is never restated.');
reset role;

select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select throws_ok(
  format($$ select public.create_external_participant(%L, 'external_person', '418 Externo') $$,
         (select org_x from k)),
  'HC0E4', null,
  '4.7 ⭐⭐ THE SECOND DECLARED LOSS: external-participant MINTING, reached through '
  '`app.can_manage_external_participant`, whose only other arm is '
  '`is_org_commission_staff_admin`. RED at head. ⚠ The errcode is `HC0E4`, not `42501` — this '
  'door raises its own coordination code, and asserting 42501 here would red forever while '
  'reading like a live defect.');
reset role;

select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select lives_ok(
  format($$ select public.create_ethics_allegation_category(%L, 'k418', 'Categoria 418') $$,
         (select org_x from k)),
  '4.8 ⭐⭐ THE RELOCATION, AND THIS IS THE CELL THAT CATCHES A BARE REMOVAL. Case VOCABULARY '
  'is inside A35''s noun list, so the platform reach SURVIVES at '
  '`app.can_manage_case_vocabulary` — where it is now an EXPLICIT `app.is_admin_for(p_uid)` '
  'arm instead of one inherited through `can_manage_professional`. Green before AND after. '
  '⛔ Deleting arm 1 and stopping there strands this door with 42501 "sem autorização para '
  'gerenciar o catálogo"; the PO measured exactly that in a rolled-back run. ⭐ The relocated '
  'arm is SUBJECT-keyed, matching both siblings, and it follows account state from the moment '
  'it lands because the SAME migration adds `app.is_active(p_user_id)` to `is_admin_for`.');
reset role;

select test_helpers.reset_role_and_claims();

-- The file rolls back, but the fixture rows are removed explicitly anyway: an
-- out-of-transaction run (a hand `\i`, a diagnostic session) must not leave a professional
-- profile or a vocabulary key behind. Same discipline as 409's and 415's tails.
delete from public.ethics_allegation_categories where key = 'k418';
delete from public.professional_profiles where id = 'fb000000-0000-0000-0000-000000000418';

select * from finish();
rollback;
