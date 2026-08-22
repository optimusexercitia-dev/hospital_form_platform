-- ADR 0134 D6 — the S8 arm of `app._case_caps`: an appointed Administrativo holding the
-- ADR-0061 `read_cases` capability reads the commission's ORDINARY cases.
-- Migration 20261003000500_case_caps_s8_administrativo_read.
--
-- ⭐ WHY `app.member_can_for` AND NOT `app.member_can` (ADR 0134 Amendment 6).
-- `app.member_can(commission, capability)` resolves **`auth.uid()`** — it takes no uid.
-- `app._case_caps(p_case_id, p_uid)` is a **(case, uid)** resolver whose callers routinely
-- ask about a THIRD party (`file_correction_request` asks about a nominated corrector;
-- `get_referral_case_access_summary` REPORTS other principals' access; the whole `_for`
-- helper family exists for it). Routed through the bare form, S8 would answer about the
-- CALLER: dark wherever `auth.uid()` is null, and — worse — setting
-- content-without-deliberation for a non-member `p_uid`, which is
-- `app.is_oversight_only_reader`'s exact bit shape and the very collision Amendment 4
-- exists to close. §1 pins the discrimination; §2 pins that the predicate has exactly ONE
-- body, so a later hand-copy reds instead of drifting.
--
-- ⭐ P10 HOLDS BY CONSTRUCTION, AND THAT IS DIFFERENT EVIDENCE FROM AN ASSERTION.
-- `member_can_for`'s third conjunct **is** `app.is_member_of_for(v_commission, p_uid)` —
-- literally the call that assigned `v_member` earlier in `_case_caps`. So `v_member`
-- cannot be false while the S8 guard is true, and on an ordinary case the appointee holds
-- content (S8) AND deliberation (S5). Amendment 4 §A4.2's "both directions" claim is
-- therefore structural, not asserted — §11 pins the OBSERVABLE consequence, and would
-- still red if a refactor broke the structure.
--
-- ⛔ WHAT WOULD MAKE EACH PIN VACUOUS — stated per section, because "green" has three
-- failure modes and only one of them is "the code is right".
--
-- Personas (bootstrap + this file):
--   sa_x  coordinator of comm_x            st_x   THE S8 SUBJECT — appointed + read_cases,
--   st_x2 plain member of comm_x, later            ZERO grants, ZERO assignments
--         an S3 read_standard_phi grantee   adm2   second appointee, used ONLY for §1's
--   sa_y  coordinator of comm_y                    conjunct pins (keeps st_x pristine)
--   qr    hospital quality_reviewer — the S7 persona that MAKES the §11 differential
--         non-vacuous: without it, "is_oversight_only_reader is false" is the default
--         answer for almost everybody and pins nothing.
-- Cases: case_o ordinary · case_l explicit_grants_only · case_p ordinary + patient
--        · case_y in comm_y (cross-commission).
-- ⚠ Every case is created by DIRECT INSERT attributed to sa_x, never by st_x through
-- `create_case`: a non-coordinator creator receives an S3 read self-grant, which would
-- make every "S8 reads it" assertion below measure S3 instead. That is the wrong-arm
-- fixture trap (authz-handoff §7.1·1), and §3's grant/assignment control is what proves
-- it was avoided.

begin;
select plan(72);

-- =========================================================================
-- (0) FLAG PRECONDITIONS — ASSERTED, NOT CLAIMED. A reading is not a fact until it is
-- pinned to the state you are claiming about: this stack is reset constantly and an
-- e2e teardown has driven it into a state no environment ships. A suite that only SETS
-- its flags can pass for the wrong reason.
-- =========================================================================
update app.feature_flags set enabled = true
  where key in ('administrativo', 'audit_trail', 'case_patient', 'cases_extras',
                'processless_cases', 'case_access');
select is(app.feature_enabled('administrativo'), true, '0.1 precondition: administrativo flag ON');
select is(app.feature_enabled('audit_trail'),   true, '0.2 precondition: audit_trail flag ON (audit_write returns SILENTLY when off)');
select is(app.feature_enabled('case_patient'),  true, '0.3 precondition: case_patient flag ON');
select is(app.feature_enabled('cases_extras'),  true, '0.4 precondition: cases_extras flag ON (assign_case_tag asserts it before authority)');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'hosp_b')::uuid as hosp_b,
         (v->>'oa_b')::uuid   as oa_b
  from ctx;
grant select on k to authenticated;

-- adm2 (the §1 conjunct-pin subject) and qr (the §11 S7 differential persona).
create temp table p on commit drop as
  select gen_random_uuid() as adm2, gen_random_uuid() as qr;
grant select on p to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
       u || '@test', now(), now()
from (select adm2 as u from p union all select qr from p) s;
update public.profiles set full_name = 'Administrativo 2',
       home_organization_id = (select organization_id from public.hospitals h, k where h.id = k.hosp_b)
  where id = (select adm2 from p);
update public.profiles set full_name = 'Quality Reviewer',
       home_organization_id = (select organization_id from public.hospitals h, k where h.id = k.hosp_b)
  where id = (select qr from p);
insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_x from k), (select adm2 from p), 'staff');
-- ⚠ `memberships_scope_shape` requires a hospital-tier role to carry BOTH
-- organization_id and hospital_id (measured from the CHECK, not assumed).
insert into public.memberships (organization_id, hospital_id, principal_id, role)
select h.organization_id, k.hosp_b, (select qr from p), 'quality_reviewer'
from public.hospitals h, k where h.id = k.hosp_b;
-- ⚠ `quality_oversight` is guarded — a direct UPDATE raises "commission oversight
-- changes must go through set_commission_oversight". Use the DOOR (oa_b is the org
-- admin of the bootstrap org), which also proves the fixture is reachable the way the
-- product reaches it.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select set_commission_oversight((select comm_x from k), 'visible');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

-- Appoint st_x + adm2 as owner (DIRECT INSERT — the appoint DOOR is 205's subject, not
-- this file's; here the appointment is a fixture, so it must not depend on that door).
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
values ((select comm_x from k), (select st_x from k),  (select sa_x from k)),
       ((select comm_x from k), (select adm2 from p),  (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
values ((select comm_x from k), (select st_x from k),  'read_cases', (select sa_x from k)),
       ((select comm_x from k), (select adm2 from p),  'read_cases', (select sa_x from k));

-- The four cases.
create temp table cs on commit drop as
  select gen_random_uuid() as case_o, gen_random_uuid() as case_l,
         gen_random_uuid() as case_p, gen_random_uuid() as case_y;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by, visibility_policy, patient_enabled)
values ((select case_o from cs), (select comm_x from k), 9401, 'Caso ordinário',   (select sa_x from k), 'commission_default', false),
       ((select case_l from cs), (select comm_x from k), 9402, 'Caso trancado',    (select sa_x from k), 'explicit_grants_only', false),
       ((select case_p from cs), (select comm_x from k), 9403, 'Caso com paciente',(select sa_x from k), 'commission_default', true),
       ((select case_y from cs), (select comm_y from k), 9404, 'Caso da comissão Y',(select sa_y from k), 'commission_default', false);

-- A tag to aim §9's write door at.
create temp table tg on commit drop as select gen_random_uuid() as tag_id;
grant select on tg to authenticated;
insert into public.case_tags (id, commission_id, name)
values ((select tag_id from tg), (select comm_x from k), 'Etiqueta S8');

-- ⛔ OWNER CONTEXT IS NOT WHAT `reset role` GIVES YOU. `reset role` restores the ROLE
-- but leaves the `request.jwt.claims` GUC set, so `auth.uid()` keeps returning the last
-- persona — and every owner-context assertion below (§1's uid discrimination especially)
-- depends on it being NULL. Each `reset role` in this file is therefore paired with an
-- explicit claims clear, and the premise is PINNED here rather than assumed: a pin whose
-- stated premise is false is the same defect as a pin that cannot fail.
select ok(auth.uid() is null,
  '0.5 ⭐ PRECONDITION: owner context — auth.uid() is NULL. §1.5c reads the BARE member_can here and requires false; with a stale claims GUC it would read some persona instead');

-- =========================================================================
-- (1) app.member_can_for — ONE PIN PER CONJUNCT, each neutralizable alone.
-- ⛔ VACUITY NOTE: every negative here is run in OWNER context, where `auth.uid()` is
-- NULL. That is deliberate — it is the context in which the bare `member_can` returns
-- false for EVERYBODY, so 1.5 is the pin that discriminates the two functions. A
-- negative asserted only under `claims_for(...)` could not tell them apart.
-- =========================================================================
select is(app.member_can_for((select comm_x from k), 'read_cases', (select adm2 from p)), true,
  '1.0 member_can_for: all four conjuncts hold => true (the POSITIVE the four negatives below are measured against)');

update app.feature_flags set enabled = false where key = 'administrativo';
select is(app.member_can_for((select comm_x from k), 'read_cases', (select adm2 from p)), false,
  '1.1 conjunct 1 (feature_enabled): the administrativo kill switch darkens it');
update app.feature_flags set enabled = true where key = 'administrativo';
select is(app.feature_enabled('administrativo'), true,
  '1.1b restore verified: the flag is back ON (a hardcoded restore goes stale like the value it replaces)');

-- ⛔ 1.2 IS A BEHAVIOURAL PIN, NOT A CONJUNCT PIN — and the difference was MEASURED, not
-- reasoned. Deleting `and app.is_active(p_user_id)` from member_can_for alone and running
-- this whole suite gives **71/71 GREEN**: the conjunct is REDUNDANT, because
-- `app.is_member_of_for(c,u)` is itself `is_active(u) AND has_role_any('commission',c,u)`
-- (catalog, 2026-08-22). The same redundancy exists in `app.member_can`'s original body
-- (`is_active(auth.uid()) AND is_member_of(c)`), so the "four conjuncts" that ADR 0134
-- Amdt 2 M8 and this file's own header describe are **three independent ones**. What
-- follows therefore pins the BEHAVIOUR — a deactivated principal is refused — and its
-- mechanism is the MEMBERSHIP conjunct, whose neutralization (1.3) does red. Claiming it
-- pins conjunct 2 would be a predicate quoted at the wrong grain.
update public.profiles set is_active = false where id = (select adm2 from p);
select is(app.member_can_for((select comm_x from k), 'read_cases', (select adm2 from p)), false,
  '1.2 BEHAVIOUR (not an independent conjunct — see the note above): a deactivated principal reaches nothing');
update public.profiles set is_active = true where id = (select adm2 from p);
select is(app.member_can_for((select comm_x from k), 'read_cases', (select adm2 from p)), true,
  '1.2b restore verified: reactivating brings the reach back (so 1.2 measured the flag on the profile, not a broken fixture)');

create temp table mrow on commit drop as
  select * from public.memberships
   where commission_id = (select comm_x from k) and principal_id = (select adm2 from p);
delete from public.memberships
 where commission_id = (select comm_x from k) and principal_id = (select adm2 from p);
select is(app.member_can_for((select comm_x from k), 'read_cases', (select adm2 from p)), false,
  '1.3 conjunct 3 (is_member_of_for): ⭐ THE ORPHAN — appointment + capability rows survive a deleted membership (no FK, no cascade), and the door still refuses');
insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_x from k), (select adm2 from p), 'staff');

select is(app.member_can_for((select comm_x from k), 'view_signoffs', (select adm2 from p)), false,
  '1.4 conjunct 4 (∃ capability row): a capability they do NOT hold is refused — the door is per-capability, not per-appointment');

-- ⭐ 1.5 — THE AMENDMENT-6 PIN. Same call, same owner context, three answers.
select is(app.member_can_for((select comm_x from k), 'read_cases', (select st_x2 from k)), false,
  '1.5a member_can_for discriminates BY UID: a plain member with no appointment is false');
select is(app.member_can_for((select comm_x from k), 'read_cases', (select adm2 from p)), true,
  '1.5b …while the appointee is TRUE in the SAME owner context, where auth.uid() is null');
select is(app.member_can((select comm_x from k), 'read_cases'), false,
  '1.5c ⭐ …and the BARE member_can is false here for everyone, because it resolves auth.uid(). This is why S8 cannot use it: _case_caps is a (case, uid) resolver');

-- =========================================================================
-- (2) CATALOG — the predicate has exactly ONE body (ADR 0134 Amdt 6, lead condition 2).
-- ⛔ An equivalence assertion (member_can = member_can_for(…, auth.uid())) would be
-- VACUOUS: once one delegates to the other it is true by construction, and a property
-- guaranteed structurally cannot be pinned by asserting it. These CAN fail — hand-copy
-- the conjunct list into a second body and 2.1 reds.
-- =========================================================================
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'app'::regnamespace
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'feature_enabled\(''administrativo'''
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'commission_administrativo_capabilities'),
  1, '2.1 ⭐ CATALOG: exactly ONE app routine carries both the administrativo flag conjunct and the capability table — the predicate has one body, not two');
select is(
  (select p.proname from pg_proc p
    where p.pronamespace = 'app'::regnamespace
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'feature_enabled\(''administrativo'''
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'commission_administrativo_capabilities'),
  'member_can_for', '2.2 CATALOG: …and it is member_can_for (2.1 alone would pass if the one body were the WRONG one)');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'app'::regnamespace and p.proname = 'member_can'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\ymember_can_for\y'),
  1, '2.3 CATALOG: member_can DELEGATES — its body calls member_can_for rather than restating the conjuncts');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'app'::regnamespace and p.proname = 'member_can_for'
      and p.prosecdef and p.provolatile = 's'),
  1, '2.4 CATALOG: member_can_for is SECURITY DEFINER + STABLE, matching every sibling _for helper');
select is(
  (select has_function_privilege('anon', p.oid, 'EXECUTE') from pg_proc p
    where p.pronamespace='app'::regnamespace and p.proname='member_can_for'),
  false, '2.5 ⛔ ACL: anon holds NO execute on member_can_for. A new function''s proacl is NULL = the PERMISSIVE default including PUBLIC, so this pins the REVOKE actually took');
select is(
  (select has_function_privilege('authenticated', p.oid, 'EXECUTE') from pg_proc p
    where p.pronamespace='app'::regnamespace and p.proname='member_can_for'),
  true, '2.6 ACL: authenticated DOES hold execute — the grant shape derived from is_member_of_for, not invented');

-- =========================================================================
-- (3) P1 — POSITIVE. An administrativo with `read_cases`, ZERO grants and ZERO
-- assignments, reads a grantless ORDINARY case.
-- ⛔ VACUITY: 3.0 is the control that makes the rest mean S8. Without it every
-- assertion here is satisfiable by an S3 grant or an S4 assignment nobody looked for.
-- =========================================================================
select is(
  (select count(*)::int from public.case_access_grants
    where case_id = (select case_o from cs) and principal_id = (select st_x from k)),
  0, '3.0a CONTROL: the subject holds ZERO case_access grants on the case (so P1 cannot be S3)');
select ok(
  not exists (select 1 from public.case_phases   where case_id = (select case_o from cs) and assigned_to = (select st_x from k))
  and not exists (select 1 from public.case_narratives where case_id = (select case_o from cs) and assigned_to = (select st_x from k)),
  '3.0b CONTROL: …and ZERO phase/narrative assignments (so P1 cannot be S4)');
select is(app.can_read_case((select case_o from cs), (select st_x from k)), true,
  '3.1 P1: can_read_case is TRUE for the appointee on a grantless ordinary case');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
          where b.case_id = (select case_o from cs)),
  '3.2 P1: the case appears on the appointee''s board (list_cases_board inherits the arm per row)');
select lives_ok(
  format($$ select public.get_case_detail(%L) $$, (select case_o from cs)),
  '3.3 P1: get_case_detail succeeds for the appointee (lives_ok, not is-not-null: the door RAISES on denial, and an abort is not a red)');
select is(
  (public.case_viewer_capabilities((select case_o from cs))->>'can_write_content')::boolean, false,
  '3.4 P1: …read-only — can_write_content is FALSE (D6: management ≠ authorship)');
select is(
  (public.case_viewer_capabilities((select case_o from cs))->>'can_manage_lifecycle')::boolean, false,
  '3.5 P1: …and can_manage_lifecycle is FALSE (close/cancel stay coordinator-only)');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

-- =========================================================================
-- (4) P2 — NEGATIVES ×2.
-- ⚠ THE SECOND HALF IS STRUCTURAL, AND SAYING SO IS THE POINT. `commission_admin_cap_
-- appointment_fk` is ON DELETE CASCADE to `commission_administrativos`, so "appointment
-- revoked ⇒ capability gone" tests an FK, not S8 — it would pass with the arm removed.
-- Reported as one negative wearing two coats, not as two independent ones.
-- =========================================================================
create temp table caprow on commit drop as
  select * from public.commission_administrativo_capabilities
   where commission_id = (select comm_x from k) and user_id = (select st_x from k);
delete from public.commission_administrativo_capabilities
 where commission_id = (select comm_x from k) and user_id = (select st_x from k) and capability = 'read_cases';
select is(app.can_read_case((select case_o from cs), (select st_x from k)), false,
  '4.1 P2a: capability revoked => the read is gone (this half IS S8)');
insert into public.commission_administrativo_capabilities select * from caprow;
select is(app.can_read_case((select case_o from cs), (select st_x from k)), true,
  '4.1b restore verified: the capability is back and the read returns');

delete from public.commission_administrativos
 where commission_id = (select comm_x from k) and user_id = (select st_x from k);
select is(
  (select count(*)::int from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select st_x from k)),
  0, '4.2a P2b CONTROL: revoking the appointment FK-CASCADED the capability row away — this is the mechanism, and it is an FK');
select is(app.can_read_case((select case_o from cs), (select st_x from k)), false,
  '4.2b P2b: appointment revoked => the read is gone. ⚠ STRUCTURAL — it follows from 4.2a and would pass with the S8 arm removed');
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values ((select comm_x from k), (select st_x from k), (select sa_x from k));
insert into public.commission_administrativo_capabilities select * from caprow;
select is(app.can_read_case((select case_o from cs), (select st_x from k)), true,
  '4.2c restore verified: appointment + capability restored, the read returns');

-- =========================================================================
-- (5) P3 — FLAG-DARK. The administrativo kill switch darkens S8 with the rest of ADR 0061.
-- =========================================================================
update app.feature_flags set enabled = false where key = 'administrativo';
select is(app.can_read_case((select case_o from cs), (select st_x from k)), false,
  '5.1 P3: flag OFF => S8 confers nothing (the kill switch reaches the arm through the chokepoint)');
select is(app.can_read_case((select case_o from cs), (select sa_x from k)), true,
  '5.2 P3 CONTROL: …while the COORDINATOR arm (S1) is flag-INDEPENDENT — so 5.1 measures the flag, not a broken fixture');
update app.feature_flags set enabled = true where key = 'administrativo';
select is(app.can_read_case((select case_o from cs), (select st_x from k)), true,
  '5.3 restore verified: flag back ON, the read returns');

-- =========================================================================
-- (6) P5 — CROSS-COMMISSION.
-- =========================================================================
select is(app.can_read_case((select case_y from cs), (select st_x from k)), false,
  '6.1 P5: an administrativo of comm_x reaches NOTHING in comm_y');
select is(app.can_read_case((select case_y from cs), (select sa_y from k)), true,
  '6.2 P5 CONTROL: …and comm_y''s own coordinator CAN read it — so 6.1 is a boundary, not a dead case');

-- =========================================================================
-- (7) P6 — THE AUDIT ROW. ⛔ REWRITTEN FROM ITS ORIGINAL SPEC, WHICH COULD NOT FAIL.
-- `public.log_audit_access` raises 42501 when unauthorized and the call sits INSIDE
-- `get_case_detail`, whose L18 gate is the SAME predicate — so the read and the audit row
-- succeed or fail TOGETHER and 3.3 already entails "a row exists". What is pinned here is
-- what 3.3 cannot: the row's actor/commission/entity, that EXACTLY ONE is emitted, and the
-- differential that gives it teeth — a COORDINATOR open emits NONE (the emission site is
-- `if not v_is_coordinator`).
-- =========================================================================
create temp table a0 on commit drop as
  select count(*)::int as n from public.audit_log
   where action = 'case.opened' and entity_id = (select case_o from cs);
grant select on a0 to authenticated;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.get_case_detail(%L) $$, (select case_o from cs)),
  '7.0 the appointee opens the case again (the emission trigger)');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;
select is(
  (select count(*)::int from public.audit_log
    where action = 'case.opened' and entity_id = (select case_o from cs)
      and actor_id = (select st_x from k) and commission_id = (select comm_x from k))
  - (select n from a0),
  1, '7.1 P6: EXACTLY ONE case.opened row, attributed to the appointee and to the case''s commission');

create temp table a1 on commit drop as
  select count(*)::int as n from public.audit_log
   where action = 'case.opened' and entity_id = (select case_o from cs);
grant select on a1 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.get_case_detail(%L) $$, (select case_o from cs)),
  '7.2 the COORDINATOR opens the same case');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;
select is(
  (select count(*)::int from public.audit_log
    where action = 'case.opened' and entity_id = (select case_o from cs))
  - (select n from a1),
  0, '7.3 ⭐ P6 DIFFERENTIAL: …and emits NO row. Existence alone asserts nothing P1 has not; the pairing is what has teeth');

-- =========================================================================
-- (8) P7 — PHI NON-LEAK, AS A DIFFERENTIAL THROUGH THE DOORS (Rule 12).
-- ⛔ NEVER against the tables. `patient_identifiers` / `patient_participants` grant
-- `authenticated` NOTHING and carry ZERO policies, so a "direct DML is denied" assertion
-- passes at the GRANT layer — with S8, without S8, and even if S8 leaked PHI through a
-- door. It is the recorded "the fixture cannot reach the failing state" shape.
-- ⛔ And `get_case_patients` returns NULL for an unknown case too, so the negative alone
-- could be NULL for the wrong reason. 8.1 (a grantee succeeds at the SAME door on the SAME
-- case) is what rules that out.
-- Door set, bounded by property (every routine whose comment-stripped prosrc references
-- `can_read_case_patient`) = exactly THREE: app._audit_access_authorized,
-- public.get_case_patients, public.get_participant_patient. Both public doors are exercised.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_patient(%L, 'Paciente S8', 'MRN-S8-9403') $$, (select case_p from cs)),
  '8.0 fixture: the coordinator writes the case''s patient identifiers through the single audited door');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

-- The S3 grantee: st_x2 gets read_case_content + read_standard_phi on case_p.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.grant_case_access(%L, %L, 'read', null, 'P7 positive control', true, false) $$,
         (select case_p from cs), (select st_x2 from k)),
  '8.0b fixture: the coordinator grants st_x2 a READ grant carrying read_standard_phi');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

select is(app.can_read_case_patient((select case_p from cs), (select st_x2 from k)), true,
  '8.1a POSITIVE CONTROL: the S3 grantee holds read_standard_phi');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select isnt(public.get_case_patients((select case_p from cs)), null,
  '8.1b ⭐ POSITIVE CONTROL, THROUGH THE DOOR: the grantee reads identifiers from get_case_patients — proving the fixture CAN reach the success state');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

select is(app.can_read_case((select case_p from cs), (select st_x from k)), true,
  '8.2a PRECONDITION: the S8 subject CAN read the case''s CONTENT — so 8.2b is a PHI denial, not a case-not-found');
select is(app.can_read_case_patient((select case_p from cs), (select st_x from k)), false,
  '8.2b P7: …and holds NO read_standard_phi. Structural: has_case_capability is a bare bit test with no lattice closure, and only S1/S3 set bit 8');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(public.get_case_patients((select case_p from cs)), null,
  '8.2c ⭐ P7 THROUGH THE DOOR: the S8 subject is refused at the SAME door, on the SAME case, where 8.1b succeeded');
select is(
  public.get_participant_patient(
    (select cp.participant_id from public.case_participants cp
      where cp.case_id = (select case_p from cs) and cp.removed_at is null limit 1)), null,
  '8.2d P7, SECOND DOOR: get_participant_patient refuses them too (2 of the 3 doors in the property-bounded set are public)');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

-- =========================================================================
-- (9) P8 — THE AUTHORSHIP BOUND. D6: read only.
-- ⛔ VACUITY: a bare throws_ok(42501) could be the flag guard rather than the authority
-- guard (`assert_extras_enabled` raises check_violation BEFORE authority is consulted),
-- or the tag could not exist. 9.3 proves the door is reachable and does its job.
-- =========================================================================
select is(app.can_write_case_content((select case_o from cs), (select st_x from k)), false,
  '9.1 P8: the S8 appointee has NO case-content write');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_case_tag(%L, %L) $$, (select case_o from cs), (select tag_id from tg)),
  '42501', 'sem permissão',
  '9.2 P8: a real content-write DOOR refuses them — errcode AND message, so the flag guard cannot answer for the authority guard');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.assign_case_tag(%L, %L) $$, (select case_o from cs), (select tag_id from tg)),
  '9.3 P8 CONTROL: …while the coordinator succeeds at that same door — so 9.2 is a refusal, not an unreachable door');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

-- =========================================================================
-- (10) P9 — THE LOCKED CASE (ADR 0134 Amendment 4). `explicit_grants_only` is invisible
-- to the arm; reach there rides an explicit grant (S3) or nothing.
-- =========================================================================
select is(app.can_read_case((select case_l from cs), (select st_x from k)), false,
  '10.1 P9: the appointee gets NOTHING on an explicit_grants_only case');
select is(app.can_read_case((select case_l from cs), (select sa_x from k)), true,
  '10.2 P9 CONTROL: …while the coordinator (S1, unbounded by v_eg) reads it — so 10.1 is the bound, not a broken case');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
             where b.case_id = (select case_l from cs)),
  '10.3 P9: …absent from their board');
select throws_ok(
  format($$ select public.get_case_detail(%L) $$, (select case_l from cs)),
  'P0002', null, '10.4 P9: …and get_case_detail refuses (no_data_found — the not-found posture)');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;

-- =========================================================================
-- (11) P10 — THE BIT SHAPE, BOTH DIRECTIONS (Amendment 4 §A4.2, whose claim was DERIVED
-- and is turned into evidence here).
-- ⛔ VACUITY: `is_oversight_only_reader` is false for almost everybody, so 11.1/11.4
-- alone pin nothing. 11.6 — a REAL S7 quality reviewer for whom the predicate is TRUE —
-- is what makes them a differential rather than a default.
-- =========================================================================
select is(app.has_case_capability((select case_o from cs), (select st_x from k), 'read_case_content'), true,
  '11.1 P10 ordinary case: the appointee holds read_case_content (S8)');
select is(app.has_case_capability((select case_o from cs), (select st_x from k), 'read_case_deliberation'), true,
  '11.2 P10 ordinary case: …AND read_case_deliberation (S5) — by construction: member_can_for''s membership conjunct IS the call that assigned v_member');
select is(app.is_oversight_only_reader((select case_o from cs), (select st_x from k)), false,
  '11.3 P10 ordinary case: …so they are NOT classified an oversight-only reader');
select is(app.has_case_capability((select case_l from cs), (select st_x from k), 'read_case_content'), false,
  '11.4 P10 locked case: they hold NEITHER bit — content is absent (S8 bounded)');
select is(app.has_case_capability((select case_l from cs), (select st_x from k), 'read_case_deliberation'), false,
  '11.5 P10 locked case: …and deliberation is absent (S5 bounded)');
select is(app.is_oversight_only_reader((select case_l from cs), (select st_x from k)), false,
  '11.6 P10 locked case: …so the predicate is false HERE TOO — the bound closes the collision in both directions');
select is(app.is_oversight_only_reader((select case_o from cs), (select qr from p)), true,
  '11.7 ⭐ P10 DIFFERENTIAL: a genuine S7 quality reviewer IS an oversight-only reader on the same case — without this row, "false" above is the default answer and pins nothing');

-- =========================================================================
-- (12) P11 — THE GRANT PATH SURVIVES. The bound narrows the ARM; it must not narrow the
-- GRANT. An explicit S3 grant on a LOCKED case still confers reach to the same appointee.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.grant_case_access(%L, %L, 'read', null, 'P11', false, false) $$,
         (select case_l from cs), (select st_x from k)),
  '12.0 fixture: the coordinator grants the appointee explicit read on the LOCKED case');
reset role;
do $$ begin perform set_config('request.jwt.claims', '', true); end $$;
select is(app.can_read_case((select case_l from cs), (select st_x from k)), true,
  '12.1 P11: the explicit grant confers reach on a case the S8 arm cannot touch');
select is(app.can_read_case_patient((select case_l from cs), (select st_x from k)), false,
  '12.2 P11: …and it is a READ grant — no PHI rides along (grant_case_access read_standard_phi = false)');

-- =========================================================================
-- (13) THE DOOR SET KEYED ON is_oversight_only_reader — ADR 0134 Amdt 4 §A4.3 item 6.
-- A DELIVERABLE, recorded here so it cannot go stale unnoticed, not a design change:
-- every surface below is UNTOUCHED by this migration (approval scope: findings first).
-- ⚠ "Routine" is a SYNTAX boundary and the property boundary is larger. Direct
-- consumers = 4. But one of them, app.can_read_case_committee, is the predicate's
-- NEGATION, and it reaches 11 RLS policies + 3 further routines — including
-- app.can_read_professional_profile, the Class-2 professional-identity PHI door. The
-- predicate is keyed on BITS, not on arms, so an arm that lands inside or outside its
-- extension moves all of them at once. Answering item 6 with "4 routines" is true and
-- misleading.
-- =========================================================================
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\yis_oversight_only_reader\y'),
  4, '13.1 DOOR SET (direct): exactly 4 routines reference is_oversight_only_reader — can_read_case_committee, declare_conflict, file_correction_request, record_recusal');
select is(
  (select count(*)::int from pg_policy pol
    where coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'')
          ~ '\yis_oversight_only_reader\y'),
  0, '13.2 DOOR SET: ZERO policies reference it DIRECTLY — which is the number that misleads (see 13.3)');
select is(
  (select count(*)::int from pg_policy pol
    where coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'')
          ~ '\ycan_read_case_committee\y'),
  11, '13.3 ⭐ DOOR SET (transitive): its NEGATION can_read_case_committee is referenced by 11 RLS policies — the real blast radius, which a routine-bounded enumeration hides');
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\ycan_read_case_committee\y'
      and p.proname <> 'can_read_case_committee'),
  3, '13.4 DOOR SET (transitive): …plus 3 further routines, incl. can_read_professional_profile — the Class-2 PHI door');
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\ycan_read_case_patient\y'),
  3, '13.5 DOOR SET: the can_read_case_patient door set is exactly 3 routines (§8 exercises the 2 public ones)');

select * from finish();
rollback;
