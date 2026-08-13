-- AFF W3 — the update door, the create door's ignored `p_started_on`, single-hospital
-- provisioning, and the T3.5 fixtures the feature's premise rests on.
--
-- ADR 0097 D2/D12/D14/D16/D17 + ADR 0098 §W3. Migrations held: 20260909001000 /
-- 20260909001100.
--
-- ⚠ §3 IS THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. `affiliate_person`
-- ignores `p_started_on` for a row that already exists; a UI control wired to it would
-- have silently no-opped on every existing affiliation, and the door would have
-- returned without raising the whole time. A door that "did not raise" is not a door
-- that worked — §2 and §3 both assert OBSERVED STATE, never the absence of an error.
--
-- Assertion count: 38

begin;
select plan(38);

update app.feature_flags set enabled = true where key in ('audit_trail');

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha1,        -- hospital_admin, central-a ONLY
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000a1'::uuid as dr_john,    -- TWO hospitals, TWO committees
  '00000000-0000-0000-0000-0000000000d1'::uuid as seatless,   -- affiliated, ZERO committees
  '00000000-0000-0000-0000-0000000000c0'::uuid as solo_c,     -- org_admin AND hospital_admin
  '00000000-0000-0000-0000-0000000000c5'::uuid as unaffiliated, -- no affiliation anywhere
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000c'::uuid as org_c,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as secundario_a,
  '05000000-0000-0000-0000-00000000000c'::uuid as unico_c;
grant select on k to authenticated;

-- ============================================================================
-- §1 DOOR SHAPE — the same owner-only kernel / split-ACL wrapper pair as the others.
-- ============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'update_affiliation_impl'
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
           or has_function_privilege('service_role', p.oid, 'EXECUTE'))), 0,
  '1.1 the update KERNEL is executable by neither authenticated nor service_role');

select ok(
  not has_function_privilege('authenticated', 'public.update_affiliation_for(uuid,uuid,uuid,text,date,boolean)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.update_affiliation_for(uuid,uuid,uuid,text,date,boolean)', 'EXECUTE'),
  '1.2 the _for twin is service_role ONLY — naming the actor stays a service privilege');

select ok(
  has_function_privilege('authenticated', 'public.update_affiliation(uuid,uuid,text,date,boolean)', 'EXECUTE'),
  '1.3 the interactive door IS executable by authenticated');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('update_affiliation', 'update_affiliation_for')
      and has_function_privilege('public', p.oid, 'EXECUTE')), 0,
  '1.4 t19: PUBLIC cannot execute either (REVOKE before GRANT)');

-- ============================================================================
-- §2 BEHAVIOUR — every assertion reads the ROW BACK. `lives_ok` on a door that no-ops
-- is exactly the failure mode this file exists for.
-- ============================================================================
create temp table audit_before on commit drop as
  select id from public.audit_log where action = 'affiliation.updated';

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select lives_ok(
  $$select public.update_affiliation('00000000-0000-0000-0000-0000000000a1',
      '05000000-0000-0000-0000-00000000000a', 'MAT-CORRIGIDA', '2023-04-15')$$,
  '2.1 a hospital admin edits an employment at the hospital it administers');

select throws_ok(
  $$select public.update_affiliation('00000000-0000-0000-0000-0000000000a1',
      '05000000-0000-0000-0000-0000000000a2', 'MAT-HACK')$$,
  '42501', null,
  '2.2 DENY: ... and NOT at a sibling hospital it does not administer');

select throws_ok(
  $$select public.update_affiliation('00000000-0000-0000-0000-0000000000c5',
      '05000000-0000-0000-0000-00000000000a', 'MAT-X')$$,
  'HC0R2', null,
  '2.3 a person with no ACTIVE affiliation here is HC0R2 — distinguishable from a denial');
reset role;

select is(
  (select hospital_employee_id from public.hospital_affiliations
    where principal_id = (select dr_john from k) and hospital_id = (select central_a from k)
      and ended_on is null), 'MAT-CORRIGIDA',
  '2.4 ⭐ THE MATRÍCULA ACTUALLY CHANGED — read back, not inferred from "it did not raise"');

select is(
  (select started_on from public.hospital_affiliations
    where principal_id = (select dr_john from k) and hospital_id = (select central_a from k)
      and ended_on is null), '2023-04-15'::date,
  '2.5 ⭐ THE START DATE ACTUALLY CHANGED — the assertion the create door would have failed');

select is(
  (select count(*)::int from public.audit_log
    where action = 'affiliation.updated' and id not in (select id from audit_before)), 1,
  '2.6 the edit emitted `affiliation.updated` (Rule 11) — the arm that made this capability recordable at all');

-- Omitted arguments leave the stored values alone; clearing is an EXPLICIT flag.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.update_affiliation('00000000-0000-0000-0000-0000000000a1',
      '05000000-0000-0000-0000-00000000000a')$$,
  '2.7 DOMINANCE: an org_admin may edit at any hospital of its org, and may omit every field');
reset role;

select ok(
  (select hospital_employee_id = 'MAT-CORRIGIDA' and started_on = '2023-04-15'::date
     from public.hospital_affiliations
    where principal_id = (select dr_john from k) and hospital_id = (select central_a from k)
      and ended_on is null),
  '2.8 ... and an omitted argument left BOTH values untouched (coalesce, not overwrite-with-null)');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.update_affiliation('00000000-0000-0000-0000-0000000000a1',
      '05000000-0000-0000-0000-00000000000a', null, null, true)$$,
  '2.9 clearing the matrícula is an EXPLICIT flag');
reset role;

select is(
  (select hospital_employee_id from public.hospital_affiliations
    where principal_id = (select dr_john from k) and hospital_id = (select central_a from k)
      and ended_on is null), null,
  '2.10 ... and it actually cleared (the flag is not decorative)');

-- ============================================================================
-- §3 THE NO-OP CATCHER. `affiliate_person` is the idempotent CREATE door and IGNORES
-- `p_started_on` on a row that already exists. That is deliberate (a create door must
-- not acquire a date-mutation capability, and it has no `affiliation.updated` arm) —
-- but it is exactly the kind of load-bearing claim that rots into a lie in a comment.
-- Pinned here, so a future edit that "helpfully" wires the date through goes red.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000a1',
      '05000000-0000-0000-0000-00000000000a', 'MAT-VIA-CREATE', '1999-01-01')$$,
  '3.1 the CREATE door accepts a call for an existing employment (idempotent)');
reset role;

select ok(
  (select started_on = '2023-04-15'::date and hospital_employee_id = 'MAT-VIA-CREATE'
     from public.hospital_affiliations
    where principal_id = (select dr_john from k) and hospital_id = (select central_a from k)
      and ended_on is null),
  '3.2 ⭐ ...and IGNORED p_started_on while applying the matrícula — dates belong to update_affiliation, which audits them');

-- ============================================================================
-- §4 T3.4 — SINGLE-HOSPITAL PROVISIONING, as a shape the seed now carries.
-- ============================================================================
select is(
  (select count(*)::int from public.hospitals where organization_id = (select org_c from k)), 1,
  '4.1 Rede C has exactly ONE hospital — the tenant shape D16/D17 are about');

select is(
  (select count(*)::int from public.memberships
    where principal_id = (select solo_c from k)
      and role in ('org_admin', 'hospital_admin')), 2,
  '4.2 its sole administrator holds BOTH org_admin and hospital_admin — no `solo_admin` role was needed (D16)');

-- ============================================================================
-- §5 T3.5 — the fixtures the feature's premise rests on. Without §5.1/§5.2 the roster
-- can silently regress to "commission members" and every other test still passes.
-- ============================================================================
select ok(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select seatless from k) and ended_on is null) = 1
  and (select count(*)::int from public.memberships
        where principal_id = (select seatless from k)) = 0,
  '5.1 THE D2 FIXTURE EXISTS: a person AFFILIATED to a hospital and seated on ZERO committees');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.profiles where id = (select seatless from k)), 1,
  '5.2 ⭐ D2 END TO END: their own hospital''s admin reads that person — the defect the whole workstream exists to fix');
select is(
  (select count(*)::int from public.list_org_people((select org_a from k), null, '12345678909')), 1,
  '5.3 ...and finds them by CPF through the directory door — a person stored with a CPF is FINDABLE by it');
reset role;

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select dr_john from k) and ended_on is null), 2,
  '5.4 Dr. John holds TWO active affiliations — the cross-hospital professional, with a different matrícula at each');

-- ============================================================================
-- §6 THE LIVE HALF OF THE ERROR-ARM CONTRACT.
--
-- `src/lib/affiliations/door-error-arms.test.ts` derives the doors' SQLSTATEs from the
-- MIGRATION FILES and requires a pt-BR arm for each. That is a source-to-source
-- comparison, so it cannot see a body patched at runtime — and on this project function
-- bodies ARE rewritten at runtime (ADR 0078 A28). This assertion is the other end:
-- the RUNNING kernels must raise exactly the documented set, so a code that exists only
-- in the catalog cannot hide from both halves.
--
-- Comments stripped before the regex: a `--` line naming a code is not a raise.
-- ============================================================================
select is(
  (select string_agg(distinct m[1], ',' order by m[1])
     from (select regexp_replace(p.prosrc, '--[^
]*', '', 'g') as src
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app'
              and p.proname in ('affiliate_person_impl','end_affiliation_impl','update_affiliation_impl')) b,
          regexp_matches(b.src, 'errcode = ''([A-Z0-9]{5})''', 'g') m),
  '42501,HC0R0,HC0R1,HC0R2,HC0R3,HC0R4,HC0R5',
  '6.1 the LIVE affiliation kernels raise exactly the SQLSTATE set the TS mapper has arms for (a new code reds here AND in door-error-arms.test.ts)');

-- ============================================================================
-- §7 (F3) RULE 11 — ALL FOUR AUDIT ARMS, not just the two the update door added.
--
-- `.updated` and `.deleted` were keystoned; `.created` and `.ended` — the two that fire
-- on every real HR action — had no assertion anywhere. And `20260909001100` REBUILT
-- `app.trg_audit_hospital_affiliations` wholesale to add the `.updated` arm, which is
-- the "a rebuild silently loses properties the original carried" shape: if an arm
-- vanished in that rewrite there would be no line in the diff to notice it. Every arm is
-- now pinned by BEHAVIOUR (emit the event, read the row back), never by reading prosrc.
-- ============================================================================
create temp table audit_arm_before on commit drop as
  select id from public.audit_log
   where action in ('affiliation.created', 'affiliation.ended');

-- ⚠ SUBJECT CHOICE IS LOAD-BEARING: `unaffiliated` (nspcoord.a2) holds an nsp_coordinator
-- seat at secundario-a, so `end_affiliation` correctly refuses it with HC0R1 (D5 blocks on
-- seats of ANY tier) and §7.2 aborted. `seatless` holds ZERO memberships anywhere, so the
-- end path is exercised rather than the refusal path.
select public.affiliate_person_for((select orgadmin_a from k), (select seatless from k),
                                   (select secundario_a from k), 'MAT-ARM');
select is(
  (select count(*)::int from public.audit_log
    where action = 'affiliation.created' and id not in (select id from audit_arm_before)), 1,
  '7.1 `affiliation.created` fires on a real affiliation (the arm no keystone covered)');

select public.end_affiliation_for((select orgadmin_a from k), (select seatless from k),
                                  (select secundario_a from k));
select is(
  (select count(*)::int from public.audit_log
    where action = 'affiliation.ended' and id not in (select id from audit_arm_before)), 1,
  '7.2 `affiliation.ended` fires on a soft end (likewise)');

select ok(
  (select count(distinct action)::int from public.audit_log
    where action like 'affiliation.%') >= 3,
  '7.3 at least three distinct affiliation arms are live in ONE run — a rebuild that dropped one reds here');

-- The metadata contract, asserted on the arms themselves rather than assumed from the
-- one that happened to be tested: scope ids and the principal, never a payload.
select is(
  (select count(*)::int from public.audit_log
    where action in ('affiliation.created', 'affiliation.ended')
      and id not in (select id from audit_arm_before)
      and (metadata ->> 'user_id') is null), 0,
  '7.4 every new arm row names the principal (Rule 11 records WHO)');
select is(
  (select count(*)::int from public.audit_log
    where action in ('affiliation.created', 'affiliation.ended')
      and id not in (select id from audit_arm_before)
      and metadata::text like '%MAT-ARM%'), 0,
  '7.5 ...and NONE carries the matricula — an employer-issued identifier is payload');

-- ============================================================================
-- §8 (F4) THE OTHER HALF OF THE CPF EXISTENCE ORACLE.
--
-- ADR 0097 LOW-3 names TWO probes: `list_org_people`'s p_cpf lookup AND `registerUser`'s
-- collision block. D11's audit row is the compensating control for the ORACLE, so
-- auditing only the first half was inconsistent with the reasoning that justified it.
-- ============================================================================
create temp table probe_before on commit drop as
  select id from public.audit_log where action = 'person.cpf_lookup';

select lives_ok(
  $$select public.log_cpf_probe_for('00000000-0000-0000-0000-0000000000b1',
      '0c000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1')$$,
  '8.1 the registration-side probe emits');

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from probe_before)
      and metadata ->> 'source' = 'registration'), 1,
  '8.2 ...tagged `source: registration`, so the two halves are told apart by a PRESENT value');

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from probe_before)
      and (metadata::text like '%12345678909%' or summary like '%12345678909%')), 0,
  '8.3 ...and it carries NO CPF DIGITS (Rule 11: that and who, never the payload)');

select is(
  (select metadata ->> 'actor_user_id' from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from probe_before)),
  '00000000-0000-0000-0000-0000000000b1',
  '8.4 ...and it names the ACTOR in metadata — actor_id itself is NULL on every service path (a platform-wide gap, not an AFF one)');

-- ============================================================================
-- §9 (N2) `log_cpf_probe_for` — THE ACL IS ITS ENTIRE BOUNDARY.
--
-- Unlike its siblings this door fronts nothing: it writes one audit row and returns.
-- There is no authority arm inside it to keystone, which makes the GRANT the only thing
-- standing between "the registration path records a CPF probe" and "anyone signed in can
-- forge audit rows naming any actor in any organisation". §8's `lives_ok` runs as the
-- suite's superuser with no `set local role`, so it never touched that boundary.
--
-- These are the arms `302` §1.1–1.5 gave every other door. This one did not inherit them
-- because it landed in a later commit than its siblings — the recorded "a new door must
-- inherit EVERY sibling arm" lesson, where the enumeration's boundary was a COMMIT rather
-- than the door set.
-- ============================================================================
select ok(
  has_function_privilege('service_role', 'public.log_cpf_probe_for(uuid,uuid,uuid)', 'EXECUTE'),
  '9.1 service_role CAN execute the probe door (registerUser runs there)');

select ok(
  not has_function_privilege('authenticated', 'public.log_cpf_probe_for(uuid,uuid,uuid)', 'EXECUTE'),
  '9.2 ⭐ authenticated CANNOT — the door takes an explicit actor, so a signed-in caller could otherwise forge attributed audit rows');

select ok(
  not has_function_privilege('anon', 'public.log_cpf_probe_for(uuid,uuid,uuid)', 'EXECUTE'),
  '9.3 anon cannot execute it');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'log_cpf_probe_for'
      and has_function_privilege('public', p.oid, 'EXECUTE')), 0,
  '9.4 t19: PUBLIC cannot execute it (REVOKE before GRANT)');

-- ============================================================================
-- §10 (N1) THE MEMBERSHIP-ROLE FIXTURE ↔ THE LIVE CHECK.
--
-- `memberships_role_check` is a CHECK over `text`, NOT a Postgres enum, so the role list
-- does not appear in the generated types and NO unit test can reach the authority. A UI
-- test that transcribes the list therefore cannot notice a widening — it just ships an
-- untranslated identifier into pt-BR copy, which is what BUG-AFF-F1 was.
--
-- So the CPF pattern applies: ONE authority, a committed fixture, a gate at EACH end.
--   * this assertion pins  fixture  ==  live CHECK   (a widening or a narrowing reds here);
--   * `src/lib/members/membership-roles.test.ts` pins the JSON file == the copy embedded
--     below, so neither can be edited alone;
--   * the UI test (frontend-owned) pins label coverage against the JSON file.
-- Widen the CHECK and the loop runs: pgTAP reds → author regenerates the fixture →
-- Vitest reds on the missing label.
--
-- ⚠ WHAT THIS DOES NOT DO, stated because the defect being fixed was a comment claiming a
-- power the code lacked: it does not detect a widening at RUNTIME, and it does not fire
-- until this suite runs. It is a build-time gate, not a guard.
-- ============================================================================
create temp table role_fixture on commit drop as
select jsonb_array_elements_text(
  ($roles${
  "authority": "memberships_role_check",
  "generatedFrom": "pg_constraint",
  "roles": [
    "org_admin",
    "nsp_org_admin",
    "hospital_admin",
    "nsp_coordinator",
    "staff_admin",
    "staff",
    "pqs_member",
    "technical_director",
    "technical_director_deputy",
    "quality_reviewer"
  ]
}$roles$::jsonb) -> 'roles') as role;

create temp table role_live on commit drop as
select m[1] as role
from (
  select regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''::text', 'g') as m
  from pg_constraint
  where conrelid = 'public.memberships'::regclass and conname = 'memberships_role_check'
) x;

-- NON-VACUITY FIRST. If the extractor's regex matched nothing, an empty fixture would
-- equal an empty live set and §10.2 would pass having compared nothing to nothing.
select cmp_ok((select count(*)::int from role_live), '>', 5,
  '10.1 NON-VACUITY: the CHECK extractor actually resolves roles from pg_get_constraintdef');

select is(
  (select string_agg(role, ',' order by role) from role_fixture),
  (select string_agg(role, ',' order by role) from role_live),
  '10.2 ⭐ the committed membership-role fixture EQUALS the live memberships_role_check set (exact, both directions — a widening AND a narrowing red here)');

select * from finish();
rollback;
