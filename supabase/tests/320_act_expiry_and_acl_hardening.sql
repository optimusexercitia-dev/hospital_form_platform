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
-- BUDGET (+18, FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN, 2026-09-08, pre-AE5
-- Batch 7): 14 `is` + 4 `ok` = 18 call sites, against tags U4a·U4b·U4c (the pin, 3)
-- · U5a-U5g (the rising control, 7) · U6a-U6h (the falling control in two halves
-- plus the §U1-undisturbed closer, 8) = 18. 18 + 18 = 36.
select plan(36);

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

-- ===========================================================================
-- U4 · U5 · U6 — THE PRIVILEGE BUDGET: the `authenticated`-executable DEFINER
-- population of `app` + `public`, pinned per schema AND in total.
-- Added 2026-09-08, pre-AE5 Batch 7 (unit PRIVILEGE-SURFACE), rulings R10/R11/
-- R15/R24. Follow-up: FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN.
--
-- ── WHY HERE AND NOT IN A NEW FILE (ruling R15) ────────────────────────────
-- Because §U1 above is an INCUMBENT ratchet over overlapping catalog surface —
-- an `app` DEFINER whose `proacl IS NULL` is in BOTH populations — and two
-- ratchets over overlapping surface, in two files, with two merge rules, drift.
-- Extending removes that leg outright. ⛔ This file is deliberately NOT renamed:
-- a rename orphans every name-keyed citation of `320`.
--
-- ── THE BOUNDARY BETWEEN §U1 AND §U4, WRITTEN FOR A REVIEWER ───────────────
-- These two look alike and are not. State the three differences before reading
-- either number, because "236 and 759 are both counts of app functions" is the
-- misreading that would let one be edited to satisfy the other.
--
--   POPULATION.       §U1 counts `app` functions reachable by **PUBLIC** — i.e.
--                     `proacl IS NULL` (the Postgres default, which INCLUDES
--                     PUBLIC) or an explicit PUBLIC grantee. It does not look at
--                     `prosecdef` and it does not look at `public`.
--                     §U4 counts **SECURITY DEFINER** functions in `app` **and**
--                     `public` for which **`authenticated`** resolves EXECUTE by
--                     any route. Neither population contains the other: an `app`
--                     INVOKER with a default ACL is in §U1 only; a `public`
--                     DEFINER granted to `authenticated` is in §U4 only.
--
--   DECISION OWNER.   §U1's 236 moves by **triage** — it is a work item
--                     (FUP-ACL-APP-POPULATION) driving a number down, and it
--                     already moved 237 → 236 with the removal named in a
--                     migration. §U4's ceiling moves **ONLY BY PO RULING**
--                     (`docs/backend-state.md` § Privilege budget, MERGE RULE).
--                     ⛔ An engineer may not edit §U4's CEILING (759); the same
--                     engineer may lower §U1's with the removal measured.
--                     ⚠ CORRECTED 2026-09-08: this read *"may not edit §U4's
--                     literals"*, plural, which handed the per-schema pins the
--                     ceiling's owner. They do not have it — 326 and 433 are
--                     measurements, not rulings (see §U4's own note below), and
--                     a total-preserving re-distribution reds them with no PO
--                     decision involved. Their owner is the triage owner, same
--                     as §U1's.
--
--   DIRECTION OF CONCERN. §U1 fears the set GROWING while triage is pending.
--                     §U4 fears the same, but its FALL is also interesting: a
--                     drop can mean a migration half-applied and functions
--                     vanished. Hence §U6 — the falling control — which §U1 has
--                     no counterpart for.
--
--   ⛔ NEITHER DERIVES FROM THE OTHER, and neither is computed from the other's
--   number. Both re-derive from the live catalog on every run. If they ever
--   disagree in a way that looks like arithmetic, that is a coincidence of this
--   database's contents, not a relationship.
--
-- ── RECONCILIATION WITH `ARM=census`'s STANDING PROHIBITION (ruling R10) ────
-- `supabase/tests/mutation/p0-authz-invariant.sh` (`run_arm_census`) forbids
-- exactly this shape and says why: *"⚠ DERIVED, NEVER FROZEN … A number a banner
-- states about a population NOTHING re-derives is a claim with no owner, and
-- this arm exists to stop exactly that shape."* It was filed after a literal
-- `(407 reachable)` drifted to 427 while printing beside four green arms.
--
-- This gate survives that prohibition only if THREE things hold, and all three
-- are asserted, not asserted-about:
--   (i)   THE POPULATION FIGURE IS RE-DERIVED EVERY RUN. `pg_temp.budget()`
--         below queries the live catalog; nothing is read from a file.
--   (ii)  THE COMMITTED CEILING IS A DECISION, NOT A DESCRIPTION. 759 is what
--         the PO ruled on 2026-09-08, having been shown the seven increments
--         named one by one. A ruling written down is not a stale claim about a
--         population; it is the record of a decision, and it is supposed to
--         stay put until the next ruling.
--         ⚠ CORRECTED 2026-09-08 — this condition used to be claimed for all
--         THREE literals, and for two of them it is false: `app` 326 and
--         `public` 433 are descriptions of a population, which is precisely what
--         the census prohibition is about. ⇒ (ii) is claimed for 759 ALONE.
--         ⭐ WHAT ACTUALLY CARRIES THE OTHER TWO IS (i), AND (i) ALONE IS
--         ENOUGH. The census banner's `(407 reachable)` was PRINTED and compared
--         to nothing, so it could drift 20 while four arms stayed green. These
--         literals are COMPARED, every run, against a figure `pg_temp.budget()`
--         re-derives from the live catalog — a drift cannot survive one run.
--         That is a different object from a banner, and it is the difference
--         (ii) was being asked to carry and could not.
--         ⛔ HONEST ABOUT WHAT WE DID NOT DO: `ARM=census`'s own remedy went
--         further — it made the printed figure DERIVED FROM THE PREDICATE, so
--         "the figure and the class can never disagree again". §U4 does not do
--         that; it commits a literal and gates its copies. That is a deliberate
--         and different choice — it is exactly what §U1 is, and it is what makes
--         a RATCHET possible at all, since a derived figure cannot ratchet
--         against itself — but it is weaker, and the weakness is (iii)'s job.
--   (iii) THE DECISION HAS ONE HOME, AND EVERY COPY IS GATED.
--         ⭐ ONE HOME = `docs/backend-state.md` § Privilege budget.
--         The literals below are a MIRROR, and `npm run lint:budget-anchor`
--         (gate 15) reds if the mirror and the home ever disagree. That is what
--         converts R10's "two homes" objection into "one home plus a gated
--         mirror". ⛔ If that gate is ever removed, this section inherits the
--         census prohibition in full and must be re-argued or deleted.
--
-- ── POLARITY (ruling R11) ──────────────────────────────────────────────────
-- EXACT EQUALITY, both directions, matching §U1 — deliberately NOT `<= ceiling`.
-- A one-directional ceiling leaves the opposite polarity unproven, and a FALL is
-- not automatically good news: it is what a half-applied migration looks like.
-- The ceiling's `<=` semantics live in gate 15 instead, which is where the
-- observed figure and the ruled ceiling are compared as two different things.
--
-- ⛔ WHEN THIS REDS: do not edit the literals. A rise means a new
-- `authenticated`-executable DEFINER arrived — name it, attribute it to its
-- migration, and take it to the PO under the merge rule. A fall means one left —
-- find out which, because nobody has revoked anything.
-- ===========================================================================

reset role; -- defensive: §U1-§U3 leave the session as postgres, and this asserts it rather than assuming

-- ONE definition of the population, used by all three sections, so U4's pin and
-- U5/U6's controls cannot silently measure two different things.
create function pg_temp.budget(p_schema text default null) returns int
  language sql stable as $bud$
  select count(*)::int
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and (p_schema is null or n.nspname = p_schema)
     and p.prosecdef
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
$bud$;

-- ── §U4 — THE PIN ──────────────────────────────────────────────────────────
-- ⭐ PER SCHEMA **AND** TOTAL. A total-only pin is blind to a +1/-1 pair across
-- the two schemas: one function added to `public` and one lost from `app` nets
-- to zero and would pass silently. The parts must sum to the whole, and pinning
-- all three is what makes that checkable.
--
-- ⛔ ONE OF THESE THREE LITERALS IS A RULING; THE OTHER TWO ARE MEASUREMENTS.
-- ⚠ CORRECTED 2026-09-08. This paragraph read *"THESE THREE LITERALS ARE A
-- RULING, NOT A MEASUREMENT THE BUILDER CHOSE"*, which is true of one and false
-- of two — and saying it of all three is the kind of claim that later gets
-- quoted to refuse a legitimate repair. The honest split:
--
--   759 (`total`) IS A RULING. PO ruling 2026-09-08 (Batch 7 R24): "Move the
--   ceiling to 759", on the measured basis that all seven increments over the
--   previous ceiling of 752 are attributed, four are structurally required by
--   live RLS policy expressions (which evaluate as the INVOKING role), and three
--   were sent for a reachability analysis rather than assumed.
--
--   326 (`app`) and 433 (`public`) ARE MEASUREMENTS, pinned as a ratchet. The PO
--   was never asked how the total should DISTRIBUTE across the two schemas and
--   ruled nothing about it; these two describe a population, which is exactly
--   what a measurement is. They are pinned because a total-only pin is blind to
--   a +1/-1 pair (see above), not because anyone decided they should be these
--   values.
--
-- ⇒ THE CONSEQUENCE, and it is not hypothetical. A legitimate re-distribution —
-- `app` 326 → 325 with `public` 433 → 434, total unchanged at 759, the merge
-- rule untouched because nothing rose — reds U4a and U4b while U4c stays green.
-- Under the old wording that repair had NO NAMED OWNER: the PO's authority is
-- over the ceiling, and a "ruling" cannot be edited by an engineer. It has one
-- now. The per-schema split moves under the SAME owner §U1 names — the triage
-- owner (FUP-ACL-APP-POPULATION) — with the mover attributed and measured, in
-- the same commit, exactly as §U1's own literal already moves. ⛔ What still
-- moves ONLY by PO ruling is 759.
--
-- The `-- BUDGET-ANCHOR` markers are read by gate 15; keep them on the literal's
-- own line.

select is(pg_temp.budget('app'),
  326,  -- BUDGET-ANCHOR app
  'budget U4a ⭐ `app` holds EXACTLY 326 SECURITY DEFINER functions that `authenticated` may EXECUTE — the PO-ruled figure of 2026-09-08, mirrored from docs/backend-state.md § Privilege budget and gated against it by npm run lint:budget-anchor');

select is(pg_temp.budget('public'),
  433,  -- BUDGET-ANCHOR public
  'budget U4b ⭐ `public` holds EXACTLY 433 — pinned separately from `app` because a total-only pin cannot see a +1/-1 pair across the two schemas');

select is(pg_temp.budget(),
  759,  -- BUDGET-ANCHOR total
  'budget U4c ⭐⭐ THE PARTS SUM TO THE WHOLE: 326 + 433 = 759, the ceiling as ruled by the PO on 2026-09-08 (superseded value: 752). ⛔ The ceiling moves ONLY by PO ruling — if this reds, attribute the mover and take it to the PO; do not edit this number');

-- ── THE CONTROL BASELINE — SNAPSHOTTED HERE, ONCE, BEFORE ANY PROBE ────────
-- ⭐⭐ WHY §U5/§U6 BELOW ASSERT DELTAS AND NOT COUNTS (fix-loop ruling R35).
-- These controls used to be written with absolute literals — `is(budget(), 760)`,
-- `is(budget(), 759)`, `is(budget('app'), 327)` — and MEASUREMENT showed what
-- that costs. Track C's mutation M1 (an unrelated `public` +1) redded **TEN**
-- assertions: U4b U4c U5b U5d U5f U6a U6c U6d U6f U6g. Only TWO of those carry
-- the finding; the other seven are controls that were never asking about the
-- baseline at all. Two separate defects follow from writing them absolutely:
--   (i)  IT BURIES THE FINDING. Seven controls red beside the two that mean
--        something, and a reader triaging ten reds cannot see which two matter.
--   (ii) ⭐⭐ IT STOPS MEASURING "THE DETECTOR MOVES" THE MOMENT THE BASELINE
--        MOVES. A control asserting `count == 760` is *trying* to assert
--        `count == baseline + 1`. Written absolutely it silently becomes a
--        second, un-owned copy of §U4's pin — and at the next ceiling move it
--        reds for a reason that has nothing to do with what it controls.
-- ⇒ The baseline is re-derived from the live catalog HERE and every §U5/§U6
--   control is expressed as a delta from it. A plant is then measured against
--   what the catalog says NOW, not against a literal that was true when it was
--   typed.
-- ⛔ §U4's pins above stay ABSOLUTE and must. They ARE the ratchet; a ratchet
--   expressed as a delta from itself asserts nothing. That is the one place in
--   this file where a literal belongs, and R35 says so explicitly.
-- ⚠ THE PIN WAS NOT WRONG AND THIS IS NOT A RED BEING FIXED — the absolute form
--   discriminates correctly today. It is a control that would have quietly
--   stopped discriminating at the next ceiling move.
--
-- ⛔ A SNAPSHOT, NOT A VIEW. `create table … as select` freezes the values at
-- this point in the transaction. A function re-querying the catalog would move
-- WITH every probe below and make every delta trivially 0 — a control that
-- cannot fail. This is the whole reason the baseline is materialised.
-- ⭐ `u1_n` snapshots §U1's OWN population here too, for U6h below. U6h is not a
-- ratchet — §U1's assertion far above is the ratchet, and it stays absolute.
-- U6h asks a strictly different question: "did §U4-§U6's probes DISTURB the
-- incumbent?" That is a delta claim in its nature, and writing it as `== 236`
-- made it red on any legitimate §U1 triage move for a reason that has nothing to
-- do with disturbance — the same defect R35 names, in §U6's last assertion.
create table pg_temp.budget_baseline as
  select pg_temp.budget()         as total_n,
         pg_temp.budget('app')    as app_n,
         pg_temp.budget('public') as public_n,
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app'
             and (p.proacl is null
                  or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)))
                                  as u1_n;

create function pg_temp.base(p_schema text default null) returns int
  language sql stable as $base$
  select case
           when p_schema is null     then total_n
           when p_schema = 'app'     then app_n
           when p_schema = 'public'  then public_n
           when p_schema = 'u1'      then u1_n
         end
    from pg_temp.budget_baseline
$base$;

-- ── §U5 — THE RISING CONTROL ───────────────────────────────────────────────
-- A population assertion that has never been shown to MOVE is a number, not a
-- detector. §U5 constructs the condition it probes for rather than borrowing it
-- from an ambient default — the same correction §U2 above already had to make.
create function app.zz_budget_probe_rising() returns boolean
  language sql immutable security definer as $r$ select true $r$;

-- ⭐ `20261003005300` revoked the built-in PUBLIC EXECUTE default for the
-- `postgres` creator role, so a freshly created function joins NOTHING on its
-- own. This is asserted rather than assumed, because the whole control depends
-- on the grant being what moves the count.
select ok(
  not has_function_privilege('authenticated', 'app.zz_budget_probe_rising()', 'EXECUTE'),
  'budget U5a CONTROL PRECONDITION: a freshly created `app` DEFINER is NOT `authenticated`-executable — 20261003005300''s default revoke is live, so the grant below is what moves the count and not an ambient default');

select is(pg_temp.budget() - pg_temp.base(),
  0,
  'budget U5b CONTROL: CREATING the probe alone does not move the budget (delta 0 from the snapshotted baseline) — the population is defined by the PRIVILEGE, not by the existence of a DEFINER function');

grant execute on function app.zz_budget_probe_rising() to authenticated;

select ok(
  has_function_privilege('authenticated', 'app.zz_budget_probe_rising()', 'EXECUTE'),
  'budget U5c CONTROL: the explicit grant MOVED the effective predicate to true');

select is(pg_temp.budget() - pg_temp.base(),
  1,
  'budget U5d ⭐ RISING CONTROL: granting ONE `app` DEFINER to `authenticated` moves the budget by EXACTLY +1 from the baseline — the detector demonstrably finds what it claims to look for, measured against what the catalog says now rather than against a literal');

select is(pg_temp.budget('app') - pg_temp.base('app'),
  1,
  'budget U5e RISING CONTROL: and it moved in the `app` half specifically (+1), so the per-schema pins are live too and not a copy of the total');

drop function app.zz_budget_probe_rising();

select is(pg_temp.budget() - pg_temp.base(),
  0,
  'budget U5f CONTROL RESTORED: dropping the probe returns the total to baseline (delta 0), so U4 measured the real population and not a leftover');

select is(pg_temp.budget('app') - pg_temp.base('app'),
  0,
  'budget U5g CONTROL RESTORED: and the `app` half too (delta 0)');

-- ── §U6 — THE FALLING CONTROL, IN TWO HALVES ───────────────────────────────
-- ⛔⛔ THE ORDER OF THE TWO ASSERTIONS IN HALF 1 IS THE WHOLE POINT.
-- `has_function_privilege` is asserted to have MOVED **before** the count is
-- asserted to have fallen. This is AE1's 137/138 lesson applied to this file's
-- own control: `revoke execute … from authenticated` against a function that
-- reaches `authenticated` through PUBLIC leaves the effective predicate TRUE and
-- moves nothing at all — and a falling control that only asserts "the count
-- fell" would then red with no indication of which of two very different things
-- happened. Worse, a control built the other way round (revoke, then assert the
-- count) can be satisfied by a DROP, by a rollback, or by nothing happening.
-- ⇒ ASSERT THE PREDICATE MOVED FIRST. A falling control that does not is a
-- control that cannot fail for the reason it was written.
--
-- Half 2 then CONSTRUCTS the silent no-op and asserts it, so the hazard is a
-- measured live property of this database rather than a warning in a comment.
create function app.zz_budget_probe_falling() returns boolean
  language sql immutable security definer as $f$ select true $f$;
grant execute on function app.zz_budget_probe_falling() to authenticated;

select is(pg_temp.budget() - pg_temp.base(),
  1,
  'budget U6a FALLING CONTROL, precondition: the probe is IN the population (delta +1 from the baseline), which is the state the fall is measured from');

revoke execute on function app.zz_budget_probe_falling() from authenticated;

select ok(
  not has_function_privilege('authenticated', 'app.zz_budget_probe_falling()', 'EXECUTE'),
  'budget U6b ⭐⭐ FALLING CONTROL, THE LOAD-BEARING HALF: the effective predicate ACTUALLY MOVED to false. Asserted BEFORE the count, because a revoke against a PUBLIC-routed function moves nothing and the count assertion alone cannot tell the two apart (AE1''s 137/138 finding)');

select is(pg_temp.budget() - pg_temp.base(),
  0,
  'budget U6c FALLING CONTROL: and only THEN, the budget fell back to the baseline (delta +1 → 0) — the detector moves in the down direction too, so a fall is observable and not merely assumed to be impossible');

drop function app.zz_budget_probe_falling();

create function app.zz_budget_probe_public_routed() returns boolean
  language sql immutable security definer as $p$ select true $p$;
grant execute on function app.zz_budget_probe_public_routed() to public;

-- ⚠ B3 / 2026-09-08 — THE PREDICATE IN THIS MESSAGE WAS CORRECTED.
-- It read *"which is exactly why 159 members of this population have no direct
-- grant at all"*. The 159 was measured under `proacl IS NULL`
-- (`docs/progress/privilege-surface.md`, the `proacl IS NULL` in budget column,
-- at all four heads). `proacl IS NULL` implies "no direct grant"; ⛔ THE CONVERSE
-- DOES NOT HOLD, and THIS UNIT IS WHAT PROVED IT DOES NOT — `docs/design/
-- authz-ae1-revoke-partition.md` §9.4 names seven `app` DEFINER functions with a
-- NON-NULL `proacl` carrying an explicit PUBLIC entry. Any of those lacking an
-- `authenticated=X` entry has no direct grant either and is NOT among the 159.
-- ⇒ "159 have no direct grant" was never measured at any head, and the gate
-- could not have told you: it is prose inside an assertion message, not a pinned
-- literal. This is ruling R26's exact confusion, twelve lines above U6e, which
-- cites R26's lesson by name. The sentence now states the predicate that WAS
-- measured. The point it makes is unchanged and still load-bearing.
select is(pg_temp.budget() - pg_temp.base(),
  1,
  'budget U6d SILENT-NO-OP HALF, precondition: a PUBLIC grant puts the probe in the budget too (delta +1) — `authenticated` resolves EXECUTE through PUBLIC, which is exactly why 159 members of this population have `proacl IS NULL` and are reached with no entry naming `authenticated` at all');

revoke execute on function app.zz_budget_probe_public_routed() from authenticated;

select ok(
  has_function_privilege('authenticated', 'app.zz_budget_probe_public_routed()', 'EXECUTE'),
  'budget U6e ⭐⭐ THE SILENT NO-OP, CONSTRUCTED AND ASSERTED: `revoke execute … from authenticated` against a PUBLIC-routed function leaves the effective predicate TRUE. This is AE1''s 138-of-233 class as a live property of this database, not a warning in a comment');

select is(pg_temp.budget() - pg_temp.base(),
  1,
  'budget U6f SILENT NO-OP: and the budget DID NOT MOVE — still +1, exactly where U6d left it. ⛔ An executed revoke batch that asserts only "the count fell" would report success here having changed nothing — which is why U6b asserts the predicate first');

drop function app.zz_budget_probe_public_routed();

select is(pg_temp.budget() - pg_temp.base(),
  0,
  'budget U6g CONTROL RESTORED: every probe dropped, the budget is back at the snapshotted baseline (delta 0)');

-- ⭐ THE INCUMBENT IS UNDISTURBED. §U6's second half grants to PUBLIC, which puts
-- its probe into §U1's population as well as this one. Asserting §U1's baseline
-- again HERE, after every probe is dropped, is what says these three new sections
-- left the incumbent ratchet measuring exactly what it measured before them.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)))
  - pg_temp.base('u1'),
  0,
  'budget U6h ⭐ §U1''s population is UNDISTURBED after §U4-§U6 have finished (delta 0 from the baseline snapshotted before the first probe) — the new sections created, granted, revoked and dropped `app` functions including one granted to PUBLIC, and left the incumbent schema-wide ratchet reading exactly what it read before them. ⛔ This asserts NON-DISTURBANCE, not the ratchet''s value; §U1''s own assertion above is what pins that, absolutely, and is the only owner of the number');

select * from finish();
rollback;
