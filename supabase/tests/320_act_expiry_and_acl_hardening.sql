-- Keystones for BUG-ACT-EXPIRY-1 (`20260918003000`) and BUG-ACT-ACL-1
-- (`20260918003100`) — the two hardening items ACT Stage 2 surfaced and deliberately
-- did NOT fix, because a behaviour-preserving refactor must preserve flaws or it is
-- smuggling an authz change under a rename.
--
-- RED-FIRST: assertions 2, 4 and 7 were confirmed RED against the pre-fix catalog
-- (the expired principal's RPC call SUCCEEDED; the body DID contain a raw
-- `public.memberships` read; PUBLIC DID hold EXECUTE). A keystone that could not
-- fail is the failure mode this project has logged repeatedly.
--
-- WHY THIS FILE EXISTS ALONGSIDE 318. Keystone 318 measures the boolean GATE
-- (`app.can_manage_professional` returns false). That is a structural claim about
-- one function. This file measures the REACH — that the refusal actually arrives at
-- a door a user can knock on. Cutting a predicate does not cut the doors that call
-- it, and a green boolean gate has previously coexisted with a wide-open door on
-- this codebase. Both claims are needed; neither implies the other.

begin;
-- U (+4, FUP-ACL-APP-POPULATION, 2026-08-17): 3 `is` + 1 `ok` = 4 call sites,
-- against tags U1 · U2 · U2b · U3 = 4.
select plan(18);

-- `create_case_assignment_role` (one of the 10 gated doors) opens with
-- `app.assert_ethics_enabled()`. Without this the RPC raises on the FLAG, not the
-- authz gate, and both the ⭐ and its CONTROL would pass for entirely the wrong
-- reason — the silent-skip failure mode logged as the pgTAP fixture-flag gap.
update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,
         (v->>'admin')::uuid  as admin_id
  from ctx;
grant select on k to authenticated;

-- ── PART 1 — BUG-ACT-EXPIRY-1, measured at the DOOR, not at the gate ────────────
--
-- The fixture is the cross-org shape, which is the only reach the quirk still had
-- after Stage 3's hat condition: sa_x keeps its LIVE staff_admin on comm_x (org_b),
-- so `custom_access_token_hook` derives the staff_admin hat implicitly — a state a
-- real user can occupy, no picker and no hand-minted claim — and additionally holds
-- an EXPIRED staff_admin in a SECOND org. An expired-ONLY principal is not usable
-- here: it can never obtain the staff_admin hat at all, so its arm was already
-- unreachable and testing it would pin logic against a state nobody can reach.
create temp table o2 on commit drop as select gen_random_uuid() as org, gen_random_uuid() as hosp;
grant select on o2 to authenticated;
insert into public.organizations (id, name, slug)
  values ((select org from o2), 'Org Expiry Door', 'org-expiry-door');
insert into public.hospitals (id, organization_id, name, slug)
  values ((select hosp from o2), (select org from o2), 'Hosp Expiry Door', 'hosp-expiry-door');
insert into public.commissions (name, slug, created_by, hospital_id)
  values ('Comissão Expiry Door', 'comm-expiry-door', (select admin_id from k), (select hosp from o2));
create temp table c2 on commit drop as
  select id from public.commissions where slug = 'comm-expiry-door';
grant select on c2 to authenticated;

insert into public.memberships (commission_id, principal_id, role, expires_at)
values ((select id from c2), (select sa_x from k), 'staff_admin', now() - interval '1 day');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- Asserted rather than assumed: the expired row is genuinely expired as far as the
-- platform's own live-membership predicate is concerned. If this ever goes green for
-- the wrong reason (say the fixture's interval stops being in the past), everything
-- below it measures nothing.
select ok(
  not app.has_role('commission', (select id from c2), 'staff_admin', (select sa_x from k)),
  'precondition: has_role() refuses the EXPIRED staff_admin row');

-- ⭐ THE DOOR, and RED pre-fix: this call SUCCEEDED before `20260918003000` and
-- inserted a real row into another org's vocabulary. `create_case_assignment_role`
-- binds `p_uid := auth.uid()` and raises 42501 from the gate, so a refusal here is
-- the gate's refusal arriving intact at a caller-reachable surface.
select throws_ok(
  format($$ select public.create_case_assignment_role(%L, 'relator-expiry', 'Relator (expiry twin)') $$,
         (select org from o2)),
  '42501', null,
  'create_case_assignment_role ⭐ BUG-ACT-EXPIRY-1: REFUSED to an EXPIRED staff_admin, correctly hatted (SUCCEEDED pre-fix — 1 of 10 Class-2 write doors)');

-- CONTROL, load-bearing: the assertion above passes for free against a door that is
-- simply broken closed, or against a fixture whose flag never enabled. Same
-- principal, same hat, same session, same RPC — only the org differs, and there
-- sa_x's staff_admin is LIVE. This is the boundary the tightening must NOT cross.
select lives_ok(
  format($$ select public.create_case_assignment_role(%L, 'relator-live', 'Relator (live control)') $$,
         (select org_b from k)),
  'create_case_assignment_role CONTROL: the LIVE staff_admin is still ADMITTED (proves the refusal above is not a broken-closed pass)');
reset role;

-- ⭐ STRUCTURAL ANTI-REGRESSION, RED pre-fix. The compensating clause is gone, and
-- the durable way to say that is "this gate no longer reads `public.memberships`
-- directly at all" — `has_role` is the single membership path, so expiry and the ACT
-- caller-only hat condition are inherited rather than re-implemented.
-- Comments are STRIPPED before matching: prose in a function body has matched a
-- `prosrc` regex on this codebase before and produced a confidently wrong reading.
-- This is exactly how the Stage 2 derivation was done, and for the same reason.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in ('can_manage_professional', 'can_create_professional',
                        'can_manage_external_participant', 'can_manage_case_vocabulary',
                        'is_org_commission_staff_admin')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'public\.memberships'),
  0,
  'the professional/vocabulary gate FAMILY ⭐ reads NO raw public.memberships '
  '(comment-stripped bodies) — has_role, through is_staff_admin_of_for, is the single '
  'membership path. ⚠ WIDENED BY AE4.7c FROM ONE NAME TO FIVE, and the widening is the '
  'assertion: the split moved the membership-touching arm OUT of can_manage_professional '
  'into is_org_commission_staff_admin, so the original single-name check would have kept '
  'passing about a body that can no longer reach memberships even in principle — green, '
  'trivial, and blind to the four gates that now can.');

-- TRIPWIRE on the door population. If any of these reds, a door was ADDED to or REMOVED
-- from one of these gates: re-derive the list from the catalog and update the count here
-- and in the migrations'' headers. Do not just bump the number — the point is that someone
-- looks at the new door and confirms it wants that gate''s semantics.
--
-- ⭐ AE4.7c TURNED ONE COUNT INTO FIVE, and it reds by design when it does. Before the
-- split, ONE gate fronted 12 RPCs spanning three unrelated capabilities — professional
-- identity (Class-2), the non-sensitive participant registry, and three case/ethics
-- vocabularies. The split gave each its own gate and then removed staff_admin from the
-- professional MODIFY half. ⛔ The instruction above is exactly what was followed: each
-- door was re-read from the catalog and assigned by what it WRITES and at what SENSITIVITY
-- (matrix § 12.3), not by its name or its table — which is how `ensure_professional_participant`
-- and `create_external_participant`, both writing `participants`, land on opposite sides.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') like '%can_manage_professional%'),
  3,
  'door population: exactly 3 public RPCs name can_manage_professional — update_professional_profile, redact_professional_profile (matrix row 30, MODIFY) and set_professional_link_state (which names BOTH gates)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') like '%can_create_professional%'),
  3,
  'door population: exactly 3 public RPCs name can_create_professional — create_professional_profile, ensure_professional_participant, set_professional_link_state (matrix row 43, ADD)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') like '%can_manage_external_participant%'),
  1,
  'door population: exactly 1 public RPC names can_manage_external_participant — create_external_participant (matrix row 31)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') like '%can_manage_case_vocabulary%'),
  6,
  'door population: exactly 6 public RPCs name can_manage_case_vocabulary — the three create/archive vocabulary pairs (matrix row 32)');

select is(
  (select count(distinct p.proname)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'can_(manage_professional|create_professional|manage_external_participant|manage_case_vocabulary)'),
  12,
  'door population ⭐⭐ THE PARTS SUM TO THE WHOLE: 12 DISTINCT public RPCs across the four gates. 3+3+1+6 = 13 counts set_professional_link_state twice BY DESIGN (it names two gates); the distinct count is 12, the same 12 this tripwire watched before the split. ⛔ Without this line the four counts above are four numbers with no relationship, and a door that fell out of the family entirely would leave every one of them green');
-- 10 → 12 (ETH·E4, ADR 0108 D1/D8). The list was RE-DERIVED FROM THE CATALOG, not
-- guessed, and each new door was looked at rather than counted:
--   + public.ensure_professional_participant — mints the participants +
--     professional_participants pair for a professional profile. WANTS this gate:
--     the population it names (platform admin, org admin, staff_admin of any
--     commission in the org) is a superset of who may call add_case_participant,
--     so the seating flow cannot dead-end on authorization.
--   + public.create_external_participant — mints a non-sensitive external
--     participant. WANTS this gate for the same reason: the predicate names the
--     POPULATION (org managers), not the professional class, so reusing it for the
--     external lane is not a widening of who may write.
-- Full membership at the time of this edit: archive_case_assignment_role,
-- archive_ethics_allegation_category, archive_ethics_sanction_type,
-- create_case_assignment_role, create_ethics_allegation_category,
-- create_ethics_sanction_type, create_external_participant,
-- create_professional_profile, ensure_professional_participant,
-- redact_professional_profile, set_professional_link_state,
-- update_professional_profile.

-- ── PART 2 — BUG-ACT-ACL-1, the EXECUTE ACL on the outlier sibling ──────────────
--
-- `proacl = NULL` is not "no grants"; it is the Postgres default for a function,
-- which is EXECUTE to PUBLIC. `app` is not a PostgREST-exposed schema, so this was a
-- hardening gap rather than a live hole — but "unreachable today" is a property of
-- config.toml, not of the grant, and config.toml can change in one line.

-- ⭐ RED pre-fix: proacl was NULL, so PUBLIC held EXECUTE and every role inherited it.
select ok(
  not has_function_privilege('anon', 'app.is_entitled_document_approver(uuid,uuid)', 'EXECUTE'),
  'is_entitled_document_approver ⭐ BUG-ACT-ACL-1: anon holds NO EXECUTE (inherited it from PUBLIC pre-fix)');

select ok(
  (select proacl is not null and not exists (
     select 1 from aclexplode(p.proacl) a where a.grantee = 0)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'is_entitled_document_approver'),
  'is_entitled_document_approver: proacl is materialised and carries NO PUBLIC (grantee 0) entry');

-- The over-revoke twin. A REVOKE that also strands the legitimate callers would look
-- identical to a correct fix in the two assertions above, and this door is reached
-- from `public.submit_document_for_approval`.
select ok(
  has_function_privilege('authenticated', 'app.is_entitled_document_approver(uuid,uuid)', 'EXECUTE'),
  'is_entitled_document_approver: authenticated RETAINS EXECUTE (the revoke did not strand the door)');

select ok(
  has_function_privilege('service_role', 'app.is_entitled_document_approver(uuid,uuid)', 'EXECUTE'),
  'is_entitled_document_approver: service_role RETAINS EXECUTE');

-- UNIFORMITY across the whole Stage-2 rebased set. This is the assertion that
-- generalises past the one instance: it reds if a future migration adds a sibling
-- with the default ACL, and — the documented failure mode — if any of the 8 is ever
-- rebuilt with DROP+CREATE instead of CREATE OR REPLACE, because a rebuild silently
-- loses the ACL the original carried.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in ('can_manage_professional', 'is_entitled_document_approver',
                        'is_hospital_member_of', 'is_org_level_admin_within',
                        'is_org_member', 'is_pqs_member_of_any',
                        'is_pqs_operator_in_org_for', 'is_quality_reviewer_in_org',
                        -- AE4.7c's four: three capability gates + the shared ascent.
                        'can_create_professional', 'can_manage_external_participant',
                        'can_manage_case_vocabulary', 'is_org_commission_staff_admin')
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
  0,
  'ACL uniformity: NONE of the 12 named gates carries a default/PUBLIC EXECUTE ACL. '
  '⚠ 8 -> 12: AE4.7c''s four new `app` gates are added HERE ON PURPOSE rather than left to '
  'U1''s population check. U1 is the schema-wide ratchet and would catch them; this list is '
  'the one a reader consults to see WHICH gates were argued about, and a new sibling absent '
  'from it reads as one nobody looked at. ⛔ They are created AFTER 20261003005300 revoked '
  'the PUBLIC EXECUTE default, so they carry no PUBLIC grant by construction — which is '
  'exactly the kind of by-construction claim that stops being true after one DROP+CREATE.');

-- ---------------------------------------------------------------------------
-- U — FUP-ACL-APP-POPULATION: the `app` schema's POPULATION, not an allowlist.
--
-- The assertion above is bounded by 8 hard-coded names — the "remembered-doors
-- allowlist" that is blind in exactly the case that matters: a NEW `app`
-- DEFINER door (S3's `app.resolve_document_version_bytes`, on a PHI byte path)
-- inherits no coverage from it. U1 is bounded by the SCHEMA instead, so a new
-- door joins the measured set the moment it is created.
--
-- ⚠ THE `is null` ARM IS LOAD-BEARING. `aclexplode(NULL)` returns NO ROWS, so
-- an EXISTS-only test is blind to precisely the default-ACL case this exists
-- for. Both arms, always.
--
-- ── The measured baseline, and why it is a RATCHET and not 0 ────────────────
--
-- Measured 2026-08-17 against the live catalog: **237 of 454** `app` functions
-- were PUBLIC-executable (228 by default ACL — 159 of them SECURITY DEFINER —
-- plus 9 by an explicit PUBLIC grant), and `anon` resolved EXECUTE on all 237.
--
-- ⭐ THE RATCHET MOVED DOWN ONCE, DELIBERATELY: **236** since AE4.7b
-- (20261003007210) revoked the PUBLIC grant on `app.is_staff_admin_of`
-- (FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE). Eight explicit grants remain.
-- ⛔ A ratchet exists to stop the set GROWING; lowering the pin is only ever
-- legitimate with the removal named and measured, which is why the migration
-- asserts its own before/after by EFFECTIVE PRIVILEGE and 405 §§5.2-5.3 pin both
-- the revoke AND its over-revoke twin.
--
-- ⛔ A blanket revoke would BREAK THE DATABASE, and the explicit eight say why:
-- `is_admin`, `is_member_of`, `is_org_admin_of`, `eval_condition`, `answer_map`,
-- `latest_published_version`, `commission_of_version`,
-- `can_read_correction_response`. These are evaluated INSIDE RLS policies, which
-- run as whatever role is reading — including `anon` on the auth-flow paths.
-- Their PUBLIC grant is a decision, not drift. That is the over-revoke twin from
-- this file's own header, at schema scale: a fix that over-reaches passes the
-- security half while breaking every policy that calls one of them.
--
-- ⚠ `is_staff_admin_of` WAS ON THAT LIST AND ITS MEMBERSHIP WAS NEVER TRUE. The
-- sentence above is the reason the nine are exempt, and it did not hold for this
-- one — measured on the live catalog 2026-09-01, before the revoke: of the 64
-- policies whose predicate calls `app.is_staff_admin_of`, **ZERO** are granted to
-- `anon` or to PUBLIC (all 64 are `authenticated`-only), and `anon` holds SELECT
-- on **ZERO** tables in `public`, so no anon read path can reach it at all. The
-- grant was `create or replace` residue from before AE1.2's global default revoke,
-- carried forward through every rewrite — drift wearing a decision's label,
-- inside a list whose whole purpose is to distinguish the two.
--
-- Calibration, so this number is not read as an open door: `config.toml`
-- exposes ONLY the `public` schema, so an `app` function with PUBLIC EXECUTE is
-- not PostgREST-reachable. This is defence-in-depth. Driving 236 down is a
-- separate, triage-first work item (FUP-ACL-APP-POPULATION, re-scoped) —
-- pinning it here stops the set GROWING while that triage is pending, which is
-- the specific hole the allowlist left open.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
  236,
  'ACL population U1 ⭐ the `app` PUBLIC-executable set is EXACTLY its measured baseline — a new app door with a default ACL reds this, where the 8-name allowlist saw nothing');

-- U2 — the control, in t19c's style. A population assertion that has never been
-- shown to MOVE is a number, not a detector; and this one is the shape most at
-- risk of silently measuring nothing, because `aclexplode(NULL)` yields no rows.
create function app.zz_acl_population_control() returns boolean
  language sql immutable as $ctl$ select true $ctl$;

-- ⚠ THE DEFAULT NO LONGER SUPPLIES THE GRANT, SO THE CONTROL STATES IT.
-- `20261003005300` (AE1 close condition #2 / PA-F4) revoked the built-in PUBLIC EXECUTE
-- default globally for the `postgres` creator role, so a newly created app function no
-- longer joins the anon-executable population on its own and this control stopped moving
-- the count — correctly, and it FAILED, which is the control doing its job.
-- ⛔ The fix is NOT to expect the baseline instead of baseline+1: that would make a detector-vacuity
-- control pass by asserting the detector finds nothing, which is precisely what it exists
-- to rule out. The control now CONSTRUCTS the condition it is probing for instead of
-- borrowing it from an ambient default — strictly stronger, because it no longer depends
-- on a database-wide setting this suite does not own.
grant execute on function app.zz_acl_population_control() to public;

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
  237,
  'ACL population U2 ⭐ CONTROL: creating ONE app function AND GRANTING IT TO PUBLIC moves the count 236 → 237 — the detector demonstrably finds what it claims to look for. The grant is explicit since 20261003005300 revoked the PUBLIC EXECUTE default; the control constructs the condition rather than inheriting it');

drop function app.zz_acl_population_control();

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
  236,
  'ACL population U2b CONTROL RESTORED: dropping the probe returns the count to baseline, so U1 above measured the real population and not a leftover');

-- U3 — the over-revoke twin at SCHEMA scale. Without it, a future migration that
-- "fixes" U1 by revoking PUBLIC across `app` would pass the security half of this
-- file while breaking every RLS policy that evaluates one of these helpers.
select ok(
  has_function_privilege('authenticated', 'app.is_member_of(uuid)', 'EXECUTE')
  and has_function_privilege('anon', 'app.is_member_of(uuid)', 'EXECUTE'),
  'ACL population U3 ⭐ an RLS-EVALUATED helper retains EXECUTE for both authenticated AND anon — policies run as the reading role, so a schema-wide revoke must red HERE rather than in production');

select * from finish();
rollback;
