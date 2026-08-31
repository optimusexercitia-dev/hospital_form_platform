-- AE1.3 — the six person doors: authority arms, SQLSTATEs, preconditions and audit.
-- Contract: docs/plans/authz-ae1-person-doors.md §§4, 5, 7, 8, ruled in its §12.
--
-- ⭐ EVERY DOOR IS DRIVEN THROUGH `public.<name>_for` — the thing the server actions
-- actually call. 384 proves the PREDICATE; a correct predicate is not a correct door (the
-- three-shapes lesson), and the failure this file exists to catch is a door wired to the
-- WRONG CAPABILITY, which no amount of predicate testing can see.
--
-- ⚠ ROLE, STATED PRECISELY RATHER THAN OVERSOLD. The ALLOW arms run under
-- `set local role service_role`, the production shape. The DENY arms run as the owner
-- through `pg_temp.door_err`, and that changes nothing about what they measure: a door is
-- SECURITY DEFINER (so its body runs as `postgres` either way) and takes the actor as an
-- explicit PARAMETER, never from `current_user`. The invoking role decides only two
-- things — EXECUTE privilege, which is 386 §1's subject, and `auth.uid()` for the
-- `profiles` guard, which is NULL for an unclaimed session under either role (386 §3).
--
-- ⭐⭐ §0's AUDIT-FLAG CONTROL IS NOT CEREMONY. `app.audit_write`'s FIRST statement is
-- `if not app.feature_enabled('audit_trail') then return; end if;`. With that flag off,
-- EVERY audit assertion in this file passes while measuring nothing — the recorded
-- pgTAP fixture-flag-gap class. §0.1/§0.2 therefore turn the flag OFF, show the write
-- emits nothing, turn it ON, and show the same write emits exactly one row. The flag
-- being off is OBSERVABLE, so the audit arms below are not vacuous.
--
-- ⚠ IDS ARE RESOLVED BY IDENTITY, NEVER HARDCODED, for anything the seed generates with
-- `gen_random_uuid()` (the credential rows). A positional or literal-id fixture silently
-- targets a different row after a reseed.

begin;
select plan(49);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000a1'::uuid as spanning,   -- dr.john   {central_a, sec_a}
  '00000000-0000-0000-0000-000000000003'::uuid as sole,       -- staff1.ccih {central_a}
  '00000000-0000-0000-0000-0000000000c7'::uuid as hosp_tier,  -- pqsdual.a — hospital-tier (D2)
  '00000000-0000-0000-0000-0000000000d2'::uuid as cred_owner, -- ativo.registro — holds a VERIFIED credential
  '00000000-0000-0000-0000-0000000000e1'::uuid as admin_h1,   -- hospital_admin of central_a ONLY
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as org_admin_b,
  '00000000-0000-0000-0000-0000000000f4'::uuid as admin_sib,  -- quality.a2 — CONSTRUCTED sec_a-only hospital_admin
  '05000000-0000-0000-0000-0000000000a2'::uuid as sec_a,
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  'd1000000-0000-0000-0000-000000000001'::uuid as cat_physician,
  '00000000-0000-0000-0000-0000000000fe'::uuid as ghost,      -- a person that does not exist
  -- PHI sentinels: distinctive values written through the doors, then hunted for in
  -- every audit row those doors emitted (§8).
  -- ⚠ '52998224725' WAS THE FIRST CHOICE AND IS `solo.c@test.local`'s SEEDED CPF. It made
  -- §4.1 die on a 23505 that looked exactly like a defect in the finalize door and was
  -- nothing but a shared fixture value. §0.5 now measures the sentinels' freshness.
  '39053344705'::text  as phi_cpf,
  '11987654321'::text  as phi_phone,
  '1980-01-02'::date   as phi_dob,
  '999888-SP'::text    as phi_reg,
  'Fulano Sentinela PHI'::text as phi_name;
grant select on k to service_role;

-- Error capture that keeps BOTH halves, so "byte-identical" can be asserted as one value
-- rather than as two assertions that happen to agree.
create or replace function pg_temp.door_err(p_sql text) returns text
language plpgsql as $e$
declare v_state text; v_msg text;
begin
  execute p_sql;
  return 'NO ERROR RAISED';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  return v_state || '|' || v_msg;
end $e$;

-- The sibling-hospital admin the seed does not carry: hospital_admin of sec_a ONLY.
insert into public.memberships (principal_id, organization_id, hospital_id, role, granted_by)
select admin_sib, org_a, sec_a, 'hospital_admin', org_admin_a from k;

-- ============================================================================
-- §0 PRECONDITIONS — and the control that makes every audit arm below mean something.
-- ============================================================================
update app.feature_flags set enabled = false where key = 'audit_trail';

select test_helpers.reset_role_and_claims();
set local role service_role;
-- ⛔ WRAPPED, not bare. This call's SUCCESS is presupposed by the assertion
-- immediately below, and a bare `select` that RAISES kills the rest of the file:
-- pgTAP reports an abort and a failure identically (`Result: FAIL`), so the
-- assertion is never reached and never evaluated. Measured 2026-08-27: a mutation
-- narrowing this door's capability took this file from 49 assertions to 11.
-- Swallowing is safe HERE precisely because the next assertion checks the EFFECT:
-- if the door raises, the write does not happen and that assertion fails CLEANLY.
-- ⚠ Never wrap a call with no following assertion this way -- that hides it.
do $seed$ begin
  perform public.update_person_fields_for(
    (select admin_h1 from k), (select sole from k), 'Controle Flag OFF',
    (select cat_physician from k));
exception when others then null;
end $seed$;
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.fields_updated' and entity_id = (select sole from k)), 0,
  '0.1 ⭐ CONTROL: with `audit_trail` OFF a successful door write emits NO audit row — the flag is a real gate, so a fixture that forgot to enable it would pass every audit arm below while measuring nothing');

update app.feature_flags set enabled = true where key = 'audit_trail';

set local role service_role;
-- ⛔ WRAPPED, not bare. This call's SUCCESS is presupposed by the assertion
-- immediately below, and a bare `select` that RAISES kills the rest of the file:
-- pgTAP reports an abort and a failure identically (`Result: FAIL`), so the
-- assertion is never reached and never evaluated. Measured 2026-08-27: a mutation
-- narrowing this door's capability took this file from 49 assertions to 11.
-- Swallowing is safe HERE precisely because the next assertion checks the EFFECT:
-- if the door raises, the write does not happen and that assertion fails CLEANLY.
-- ⚠ Never wrap a call with no following assertion this way -- that hides it.
do $seed$ begin
  perform public.update_person_fields_for(
    (select admin_h1 from k), (select sole from k), 'Controle Flag ON',
    (select cat_physician from k));
exception when others then null;
end $seed$;
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.fields_updated' and entity_id = (select sole from k)), 1,
  '0.2 ⭐ …and with it ON the SAME call emits exactly ONE — the flag being off is OBSERVABLE, which is what makes §1.8 and §8 non-vacuous');

select is(
  (select count(*)::int from pg_trigger t
    where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal
      and t.tgname like '%audit%'), 0,
  '0.3 ⭐ `profiles` carries NO audit trigger — so these doors introduce the FIRST audit coverage of person-record mutation, and "exactly once" is the door''s own property');

select cmp_ok(
  (select count(*)::int from pg_trigger t
    where t.tgrelid = 'public.memberships'::regclass and not t.tgisinternal
      and t.tgname like '%audit%'), '>', 0,
  '0.4 …against a control showing the audit-trigger DETECTOR finds triggers where they exist — 0.3 is an absence, not a broken query');

-- ⚠ THE SENTINELS MUST NOT ALREADY EXIST. A sentinel that collides with seed data
-- fabricates a defect: the first run of this file died in §4.1 on a 23505 that read as a
-- broken finalize door and was in fact `solo.c@test.local` already holding that CPF.
select ok(
  -- AE3 (ADR 0155 D4): cpf / phone left `profiles` for `profile_private_details`.
  not exists (select 1 from public.profile_private_details p, k where p.cpf = k.phi_cpf)
  and not exists (select 1 from public.profile_private_details p, k where p.phone = k.phi_phone)
  and not exists (select 1 from public.professional_credentials c, k where c.registration_number = k.phi_reg)
  and (select app.is_valid_cpf((select phi_cpf from k))),
  '0.5 ⭐ every PHI sentinel is a VALID but UNUSED value — a sentinel shared with the seed fabricates both a defect (a spurious 23505) and, in §8, a false all-clear');

-- ============================================================================
-- §1 update_person_fields — TWO ARMS IN ONE DOOR (design §4.3).
--
-- ⭐ The spanning person is the ONLY fixture in which an INTERSECTION/SUBSET swap is
-- visible: `fields` must pass and `cpf_change` must not, for the same actor on the same
-- person. Swap the two bounds and exactly this pair inverts.
-- ============================================================================
set local role service_role;
select lives_ok(
  format($$select public.update_person_fields_for(%L::uuid, %L::uuid, %L, %L::uuid,
                 true, %L, true, %L::date, true, %L)$$,
         (select admin_h1 from k), (select spanning from k), (select phi_name from k),
         (select cat_physician from k), (select cpf from public.profile_private_details where profile_id = (select spanning from k)),
         (select phi_dob from k), (select phi_phone from k)),
  '1.1 ⭐ INTERSECTION: an admin of {central_a} edits a {central_a, sec_a} person''s fields — allowed');
reset role;

select is(
  (select full_name from public.profiles where id = (select spanning from k)),
  (select phi_name from k),
  '1.2 …and the write LANDED — a lives_ok over a door that wrote nothing reports the same green');

select is(
  pg_temp.door_err(format($$select public.update_person_fields_for(%L::uuid, %L::uuid, %L, %L::uuid, true, %L)$$,
    (select admin_h1 from k), (select spanning from k), (select phi_name from k),
    (select cat_physician from k), (select phi_cpf from k))),
  '42501|sem permissão',
  '1.3 ⭐ SUBSET: the SAME actor on the SAME person is refused the moment the CPF actually changes — the second arm, and the exact pair that inverts if the bounds are swapped');

set local role service_role;
select lives_ok(
  format($$select public.update_person_fields_for(%L::uuid, %L::uuid, %L, %L::uuid, true, %L)$$,
    (select admin_h1 from k), (select spanning from k), (select phi_name from k),
    (select cat_physician from k), (select cpf from public.profile_private_details where profile_id = (select spanning from k))),
  '1.4 ⭐ THE GRAIN IS "ACTUALLY CHANGES", NOT "THE KEY IS PRESENT" — passing the person''s EXISTING cpf is allowed. Gating on presence would deny exactly the cross-hospital edit ADR 0133 Amdt 1 r1 exists to permit');

select lives_ok(
  format($$select public.update_person_fields_for(%L::uuid, %L::uuid, %L, %L::uuid, true, %L)$$,
    (select admin_h1 from k), (select spanning from k), (select phi_name from k),
    (select cat_physician from k),
    (select regexp_replace(cpf, '^(...)(...)(...)(..)$', '\1.\2.\3-\4')
       from public.profile_private_details where profile_id = (select spanning from k))),
  '1.5 ⭐ …and a FORMATTED spelling of that same cpf is allowed too — both sides are normalised to digits, because a comparison that disagrees with its own writer is the defect');
reset role;

-- The absent-key / explicit-null distinction the `p_set_*` booleans carry.
select is(
  (select cpf from public.profile_private_details where profile_id = (select spanning from k)),
  '11144477735',
  '1.6 PRECONDITION for 1.7: the spanning person still holds their original CPF after 1.4/1.5 — those calls changed nothing');

set local role service_role;
-- ⛔ WRAPPED, not bare. This call's SUCCESS is presupposed by the assertion
-- immediately below, and a bare `select` that RAISES kills the rest of the file:
-- pgTAP reports an abort and a failure identically (`Result: FAIL`), so the
-- assertion is never reached and never evaluated. Measured 2026-08-27: a mutation
-- narrowing this door's capability took this file from 49 assertions to 11.
-- Swallowing is safe HERE precisely because the next assertion checks the EFFECT:
-- if the door raises, the write does not happen and that assertion fails CLEANLY.
-- ⚠ Never wrap a call with no following assertion this way -- that hides it.
do $seed$ begin
  perform public.update_person_fields_for(
    (select admin_h1 from k), (select spanning from k), (select phi_name from k),
    (select cat_physician from k), false, null, false, null, false, null);
exception when others then null;
end $seed$;
reset role;

select is(
  (select cpf || '|' || coalesce(phone, 'NULL') from public.profile_private_details where profile_id = (select spanning from k)),
  '11144477735|' || (select phi_phone from k),
  '1.7 ⭐ `p_set_cpf => false, p_cpf => null` leaves the stored CPF UNTOUCHED, and the same for phone — the booleans carry the absent-key/explicit-null distinction a nullable parameter cannot, and collapsing them would let a form that omits a field NULL IT OUT');

set local role service_role;
-- ⛔ WRAPPED, not bare. This call's SUCCESS is presupposed by the assertion
-- immediately below, and a bare `select` that RAISES kills the rest of the file:
-- pgTAP reports an abort and a failure identically (`Result: FAIL`), so the
-- assertion is never reached and never evaluated. Measured 2026-08-27: a mutation
-- narrowing this door's capability took this file from 49 assertions to 11.
-- Swallowing is safe HERE precisely because the next assertion checks the EFFECT:
-- if the door raises, the write does not happen and that assertion fails CLEANLY.
-- ⚠ Never wrap a call with no following assertion this way -- that hides it.
do $seed$ begin
  perform public.update_person_fields_for(
    (select admin_h1 from k), (select spanning from k), (select phi_name from k),
    (select cat_physician from k), false, null, false, null, true, null);
exception when others then null;
end $seed$;
reset role;

select is(
  (select phone from public.profile_private_details where profile_id = (select spanning from k)), null,
  '1.8 …while `p_set_phone => true, p_phone => null` DOES clear it — 1.7 is the distinction, not an inability to write nulls');

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.fields_updated' and entity_id = (select spanning from k)), 5,
  '1.9 EXACTLY ONE audit row per successful call — five successful writes on this person so far (1.1, 1.4, 1.5, and the two set-flag calls behind 1.7/1.8), and the refused one in 1.3 emitted nothing. The cheap way to break this later is to add a trigger AS WELL');

select is(
  (select a.metadata ->> 'actor_user_id' from public.audit_log a
    where a.action = 'person.fields_updated' and a.entity_id = (select spanning from k)
    order by a.seq desc limit 1),
  (select admin_h1::text from k),
  '1.10 the actor rides in metadata — `actor_id` is NULL on every service-role path (a PRE-EXISTING platform gap, not one these doors introduce)');

select is(
  (select a.actor_id from public.audit_log a
    where a.action = 'person.fields_updated' and a.entity_id = (select spanning from k)
    order by a.seq desc limit 1),
  null,
  '1.11 ⚠ …and `actor_id` IS null, asserted rather than assumed — recorded as a queryability gap so a later reader does not mistake it for attribution loss');

select is(
  pg_temp.door_err(format($$select public.update_person_fields_for(%L::uuid, %L::uuid, %L, %L::uuid)$$,
    (select org_admin_b from k), (select sole from k), 'Invasor', (select cat_physician from k))),
  '42501|sem permissão',
  '1.12 an org_admin of ANOTHER organisation is refused at the door');

select is(
  substring(pg_temp.door_err(format($$select public.update_person_fields_for(%L::uuid, %L::uuid, %L, %L::uuid, true, %L)$$,
    (select admin_h1 from k), (select sole from k), 'Colisao', (select cat_physician from k),
    (select cpf from public.profile_private_details where profile_id = (select spanning from k)))) from 1 for 5),
  '23505',
  '1.13 a CPF collision still surfaces as 23505 through the door — the mapping to MESSAGES.cpfCollision at the call site keeps working unchanged');

-- ============================================================================
-- §2 set_person_active — the platform-wide kill switch (design §4.4).
-- ============================================================================
select is(
  pg_temp.door_err(format($$select public.set_person_active_for(%L::uuid, %L::uuid, false)$$,
    (select admin_h1 from k), (select spanning from k))),
  '42501|sem permissão',
  '2.1 ⭐ SUBSET, in its most dangerous place: an admin of {central_a} may NOT deactivate a {central_a, sec_a} person — one hospital''s offboarding would end their access everywhere');

select is(
  pg_temp.door_err(format($$select public.set_person_active_for(%L::uuid, %L::uuid, false)$$,
    (select admin_h1 from k), (select hosp_tier from k))),
  '42501|sem permissão',
  '2.2 D2: a HOSPITAL-TIER person is refused even by the admin of the hospital they are seated at');

set local role service_role;
select lives_ok(
  format($$select public.set_person_active_for(%L::uuid, %L::uuid, false)$$,
    (select admin_h1 from k), (select sole from k)),
  '2.3 …and a SOLE-footprint person in the same call shape IS deactivated — 2.1/2.2 are the bounds, not a dead door');
reset role;

select is(
  (select is_active from public.profiles where id = (select sole from k)), false,
  '2.4 …and it landed');

update public.profiles set suspended_until = now() + interval '5 days' where id = (select sole from k);

set local role service_role;
-- ⛔ WRAPPED, not bare -- same reason as the earlier `do $seed$` blocks: this
-- call's SUCCESS is presupposed by the assertion below, and a bare `select` that
-- RAISES kills the rest of the file, so that assertion is never evaluated.
do $seed$ begin
  perform public.set_person_active_for((select admin_h1 from k), (select sole from k), true);
exception when others then null;
end $seed$;
reset role;

select is(
  (select is_active::text || '|' || coalesce(suspended_until::text, 'NULL')
     from public.profiles where id = (select sole from k)),
  'true|NULL',
  '2.5 ⭐ reactivation also CLEARS a residual suspension — one door, both directions, mirroring reactivateUser''s `{is_active:true, suspended_until:null}`');

select is(
  (select string_agg(action, ',' order by seq) from public.audit_log
    where entity_id = (select sole from k) and action like 'person.%activated'),
  'person.deactivated,person.reactivated',
  '2.6 the trail branches on the DIRECTION, so it reads without decoding metadata');

-- ============================================================================
-- §3 suspend_person — a separate door, writing a DISJOINT column (design §4.5).
-- ============================================================================
set local role service_role;
-- ⛔ WRAPPED, not bare -- same reason as the earlier `do $seed$` blocks: this
-- call's SUCCESS is presupposed by the assertion below, and a bare `select` that
-- RAISES kills the rest of the file, so that assertion is never evaluated.
do $seed$ begin
  perform public.suspend_person_for((select admin_h1 from k), (select sole from k), now() + interval '3 days');
exception when others then null;
end $seed$;
reset role;

select ok(
  (select suspended_until from public.profiles where id = (select sole from k)) > now(),
  '3.1 suspension is stored');

select is(
  (select is_active from public.profiles where id = (select sole from k)), true,
  '3.2 ⭐ …and `is_active` is NOT touched — a door that "helpfully" also flipped it would be a silent widening of what suspension MEANS');

select is(
  pg_temp.door_err(format($$select public.suspend_person_for(%L::uuid, %L::uuid, null)$$,
    (select admin_h1 from k), (select spanning from k))),
  '42501|sem permissão',
  '3.3 suspension carries the SAME `lifecycle` SUBSET bound — it routes through the same kill switch, so it is not a lesser act');

-- ============================================================================
-- §4 finalize_invited_person — the invite path under Option A (design §4.2, R1).
-- ============================================================================
set local role service_role;
select lives_ok(
  format($$select public.finalize_invited_person_for(%L::uuid, %L::uuid, %L, %L::uuid, %L, %L::date, %L, true)$$,
    (select admin_h1 from k), (select sole from k), (select phi_name from k),
    (select cat_physician from k), (select phi_cpf from k), (select phi_dob from k),
    (select phi_phone from k)),
  '4.1 ⭐ a HOSPITAL_ADMIN registrar finalizes a person whose footprint is their own hospital — the path Option A''s reorder exists to keep open (under the old ordering the footprint is EMPTY and this is a 42501, i.e. a total outage of hospital_admin registration)');
reset role;

select is(
  -- ⛔ AE3: this assertion now SPANS TWO RELATIONS, and that is why it stays ONE string.
  -- `must_change_password` stayed on `profiles`; the other three moved. The door writes
  -- both in a single call, so asserting them together is what proves the split did not
  -- turn one write into two that can disagree. LEFT JOIN so a missing private-details row
  -- yields NULLs and REDS, instead of yielding no row and comparing null to null.
  (select d.cpf || '|' || coalesce(d.date_of_birth::text,'-') || '|' || coalesce(d.phone,'-') || '|' || pr.must_change_password::text
     from public.profiles pr
     left join public.profile_private_details d on d.profile_id = pr.id
    where pr.id = (select sole from k)),
  (select phi_cpf || '|' || phi_dob::text || '|' || phi_phone || '|true' from k),
  '4.2 …and every column in the door''s list landed, `must_change_password` included');

-- ⭐ 4.3 RESTORED BY THE LEAD, RE-EXPRESSED OVER THE NEW SUBSTRATE.
-- The deleted 4.3 asserted this door leaves `home_organization_id` UNTOUCHED. That
-- property was "the door must not silently re-anchor a person", and it did NOT die with
-- the column -- only its old expression did. Tenancy now lives in
-- `organization_affiliations`, so the same property is: this door does not touch that
-- table at all.
--
-- ⛔ DERIVED FROM THE CATALOG, NOT BEHAVIOURAL, AND DELIBERATELY SO. A behavioural cell
--    ("call the door, then count affiliation rows") passes for two different reasons --
--    the door abstained, or the door ran a path that happened not to write one. The body
--    not naming the table cannot be satisfied the second way. Comments are stripped
--    first: six functions in this estate mention the column ONLY in a comment recording
--    that it already left them, and an un-stripped grep reports those as live readers.
--
-- ⚠ The sweep that deleted 4.3 correctly DECLINED to invent this replacement. A
--    substitute written by the same pass that removed the original is a guess wearing
--    the original's label; it is restored here as a separate, ruled act.
select is(
  (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'organization_affiliations'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'finalize_invited_person_impl'), false,
  '4.3 ⭐ the invite-finalisation door does NOT touch `organization_affiliations` -- it writes person-level profile fields and MUST NOT re-anchor tenancy. Replaces the pre-drop cell that asserted it left `home_organization_id` untouched: same property, new substrate');

-- ⛔ 4.3 DELETED 2026-08-28 (AE2.4): it asserted that the door leaves
-- `home_organization_id` UNTOUCHED. The column is dropped, so "the door must not
-- silently re-anchor a person" is no longer expressible over profile state. ⚠ THIS IS A
-- REAL COVERAGE LOSS, not a tidy-up: nothing now asserts the door abstains from
-- re-anchoring, and the modern equivalent would be an assertion that it writes no
-- `organization_affiliations` row. Flagged in the AE2.4 report; the door's owner rules.

select is(
  pg_temp.door_err(format($$select public.finalize_invited_person_for(%L::uuid, %L::uuid, %L, %L::uuid, %L)$$,
    (select admin_sib from k), (select sole from k), 'Irmao', (select cat_physician from k),
    (select phi_cpf from k))),
  '42501|sem permissão',
  '4.4 ⭐ a hospital_admin of a SIBLING hospital in the SAME ORG is refused — constructed, because no seeded persona administers sec_a alone');

select is(
  pg_temp.door_err(format($$select public.finalize_invited_person_for(%L::uuid, %L::uuid, %L, %L::uuid, %L)$$,
    (select org_admin_b from k), (select sole from k), 'Estranho', (select cat_physician from k),
    (select phi_cpf from k))),
  '42501|sem permissão',
  '4.5 …and an org_admin of ANOTHER organisation likewise');

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.registered' and entity_id = (select sole from k)), 1,
  '4.6 exactly one `person.registered` row');

-- ============================================================================
-- §5 upsert_credential — INTERSECTION, and the not-found that is NOT an oracle.
-- ============================================================================
set local role service_role;
select lives_ok(
  format($$select public.upsert_credential_for(%L::uuid, %L::uuid, null, 'BR', 'SP', 'CRM', %L, null)$$,
    (select admin_h1 from k), (select spanning from k), (select phi_reg from k)),
  '5.1 ⭐ INTERSECTION: an admin of {central_a} may add a credential to a {central_a, sec_a} person — THE arm that reds if `credentials` is ever mis-bound to SUBSET');
reset role;

select is(
  (select count(*)::int from public.professional_credentials
    where user_id = (select spanning from k) and registration_number = (select phi_reg from k)), 1,
  '5.2 …and the row exists');

select is(
  pg_temp.door_err(format($$select public.upsert_credential_for(%L::uuid, %L::uuid, null, 'BR', 'SP', 'CRM', '777666-SP', null)$$,
    (select admin_h1 from k), (select hosp_tier from k))),
  '42501|sem permissão',
  '5.3 D2 still denies a hospital-tier target, even for the INTERSECTION capability (Amdt 1 ruling 2 left D2 untouched)');

update public.professional_credentials
   set verified_at = now() - interval '1 day', updated_at = now() - interval '1 day'
 where user_id = (select cred_owner from k);

set local role service_role;
-- ⛔ WRAPPED, not bare -- same reason as the earlier `do $seed$` blocks: this
-- call's SUCCESS is presupposed by the assertion below, and a bare `select` that
-- RAISES kills the rest of the file, so that assertion is never evaluated.
do $seed$ begin
  perform public.upsert_credential_for(
    (select admin_h1 from k), (select cred_owner from k),
    (select id from public.professional_credentials where user_id = (select cred_owner from k)),
    'BR', 'SP', 'CRM', '123456-SP', null);
exception when others then null;
end $seed$;
reset role;

select ok(
  (select verified_at is null and updated_at > now() - interval '1 minute'
     from public.professional_credentials where user_id = (select cred_owner from k)),
  '5.4 ⭐ EDITING CLEARS `verified_at` and stamps `updated_at` — a door that dropped this would silently launder an edited credential into a verified one');

select is(
  pg_temp.door_err(format($$select public.upsert_credential_for(%L::uuid, %L::uuid, %L::uuid, 'BR', 'SP', 'CRM', '555444-SP', null)$$,
    (select admin_h1 from k), (select spanning from k),
    (select id from public.professional_credentials where user_id = (select cred_owner from k)))),
  'HC0T6|registro profissional não encontrado para esta pessoa',
  '5.5 ⭐ an id belonging to ANOTHER person is HC0T6 — post-authority, so not an oracle; and it RAISES rather than matching zero rows, which is what made the old TS report "salvo" for a write that never happened');

select is(
  substring(pg_temp.door_err(format($$select public.upsert_credential_for(%L::uuid, %L::uuid, null, 'BR', 'SP', 'CRM', %L, null)$$,
    (select admin_h1 from k), (select sole from k), (select phi_reg from k))) from 1 for 5),
  '23505',
  '5.6 the 4-tuple collision still surfaces as 23505 — MESSAGES.credentialCollision keeps working');

-- ============================================================================
-- §6 delete_credential — THE INDISTINGUISHABILITY KEYSTONE (design §4.7).
--
-- ⛔ Here the credential id is the INPUT, so a distinguishable not-found would be a
-- credential-id ORACLE. This is the OPPOSITE of §5.5, where authority over `p_user` is
-- proven first — and it is exactly the asymmetry a "consistency" refactor would flatten.
-- ============================================================================
create temp table e on commit drop as
select
  pg_temp.door_err(format($$select public.delete_credential_for(%L::uuid, %L::uuid)$$,
    (select org_admin_b from k),
    (select id from public.professional_credentials where user_id = (select spanning from k)))) as unauth_valid_id,
  pg_temp.door_err(format($$select public.delete_credential_for(%L::uuid, %L::uuid)$$,
    (select admin_h1 from k), '00000000-0000-0000-0000-0000000000ee'::uuid)) as auth_bogus_id;

select is((select unauth_valid_id from e), '42501|sem permissão',
  '6.1 an unauthorized actor with a VALID credential id is refused');
select is((select auth_bogus_id from e), '42501|sem permissão',
  '6.2 an authorized actor with an UNKNOWN credential id is refused the same way');
select is((select unauth_valid_id from e), (select auth_bogus_id from e),
  '6.3 ⭐ …and the two are BYTE-IDENTICAL, SQLSTATE and message — asserted as one comparison, not as two assertions that happen to agree. Giving the unknown-id branch its own code would red here');

set local role service_role;
-- ⛔ WRAPPED, not bare -- same reason as the earlier `do $seed$` blocks: this
-- call's SUCCESS is presupposed by the assertion below, and a bare `select` that
-- RAISES kills the rest of the file, so that assertion is never evaluated.
do $seed$ begin
  perform public.delete_credential_for(
    (select admin_h1 from k),
    (select id from public.professional_credentials where user_id = (select spanning from k)));
exception when others then null;
end $seed$;
reset role;

select is(
  (select count(*)::int from public.professional_credentials where user_id = (select spanning from k)), 0,
  '6.4 …and an AUTHORIZED actor with a valid id actually deletes — 6.1/6.2 are the bounds, not a dead door');

select is(
  (select count(*)::int from public.audit_log where action = 'credential.deleted'), 1,
  '6.5 exactly one `credential.deleted` row');

-- ============================================================================
-- §7 AUTHORITY BEFORE EXISTENCE — a missing person answers as a denial (design F-B).
-- ============================================================================
select is(
  pg_temp.door_err(format($$select public.set_person_active_for(%L::uuid, %L::uuid, false)$$,
    (select admin_h1 from k), (select ghost from k))),
  '42501|sem permissão',
  '7.1 a person who DOES NOT EXIST answers exactly as an unauthorized caller does');

select is(
  pg_temp.door_err(format($$select public.set_person_active_for(%L::uuid, %L::uuid, false)$$,
    (select admin_h1 from k), (select ghost from k))),
  pg_temp.door_err(format($$select public.set_person_active_for(%L::uuid, %L::uuid, false)$$,
    (select org_admin_b from k), (select sole from k))),
  '7.2 ⭐ …byte-identical to a real denial — non-existence is FOLDED INTO the refusal, never surfaced. Not an enumeration oracle');

-- ============================================================================
-- §8 ⭐ PHI-FREE AUDIT, MEASURED STRUCTURALLY (Rule 11 / Rule 12).
--
-- Every door above wrote at least one PHI sentinel. This hunts for those literals in
-- everything those doors emitted — metadata AND summary — rather than eyeballing a
-- sample. The cardinality control comes first, so it cannot pass over an empty set.
-- ============================================================================
select cmp_ok(
  (select count(*)::int from public.audit_log
    where action in ('person.registered','person.fields_updated','person.deactivated',
                     'person.reactivated','person.suspended','credential.created',
                     'credential.updated','credential.deleted')), '>=', 10,
  '8.1 CONTROL: the doors emitted a substantial audit population — §8.2 is not scanning an empty set');

select is(
  (select string_agg(distinct a.action || ':' || a.entity_id::text, ', ' order by a.action || ':' || a.entity_id::text)
     from public.audit_log a, k
    where a.action in ('person.registered','person.fields_updated','person.deactivated',
                       'person.reactivated','person.suspended','credential.created',
                       'credential.updated','credential.deleted')
      and (a.metadata::text like '%' || k.phi_cpf || '%'
        or a.metadata::text like '%' || k.phi_phone || '%'
        or a.metadata::text like '%' || k.phi_dob::text || '%'
        or a.metadata::text like '%' || k.phi_reg || '%'
        or a.metadata::text like '%' || k.phi_name || '%'
        or coalesce(a.summary,'') like '%' || k.phi_cpf || '%'
        or coalesce(a.summary,'') like '%' || k.phi_phone || '%'
        or coalesce(a.summary,'') like '%' || k.phi_reg || '%'
        or coalesce(a.summary,'') like '%' || k.phi_name || '%')),
  null,
  '8.2 ⭐ NO audit row emitted by these doors carries a CPF, date of birth, phone, registration number or full name — Rule 11 records THAT and WHO, never the payload');

select is(
  (select (a.metadata -> 'fields') is not null from public.audit_log a
    where a.action = 'person.fields_updated' order by a.seq desc limit 1),
  true,
  '8.3 …while the changed-column NAMES are recorded — 8.2 is PHI exclusion, not an empty metadata object');

select * from finish();
rollback;
