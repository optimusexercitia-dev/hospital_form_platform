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
-- ⭐⭐ MUTATION RUN RECORD — P4 and P9-twin, re-run 2026-08-22 (QA B3).
-- ⛔ THESE TWO ARE THE ENTIRE EVIDENCE FOR THIS ARM, AND THAT IS STRUCTURAL, NOT A
-- PREFERENCE. `app._case_caps` returns `int`, so it is in NO authz ARM's domain: the
-- census covers `prosecdef` BOOLEANS, and the door audit's predicate arm additionally
-- filters on a name prefix. All four ARMs pass on this function without ever asking a
-- question about it. So there is no sweep behind these pins — only the twins below, and
-- previously they existed only as a SPECIFICATION plus a sentence asserting the outcome.
-- A run that lives in a chat message is a run no future reader can check.
--
-- Harness: `run_mut_v2.sh` — it reads `md5(pg_get_functiondef(...))` before and after,
-- and REFUSES to score anything unless the hash MOVED and then came BACK.
--   SELF-PROOF, run first: feeding it the CURRENT body as a "mutation" exits **9** with
--   "hash did NOT move — the probe did nothing". A silent non-mutation therefore cannot
--   be recorded as a passing twin. (v2 also treats an EMPTY/errored hash as a failure:
--   two empties compare equal, which would read as a stable restore. v1 hit exactly that
--   and refused to proceed, which is how this was noticed.)
--
--   P4 · the S8 arm reverted to the pre-migration body
--     probe   afbfed86c25e0a62c55163e83ad1f8a7 -> edb85248a21326eb139e7e994b9c469b
--     result  10 RED of 72 — tests 24, 25, 26 (P1), 30, 33, 36 (the restore-verified
--             positives), 39, 40 (P6 audit), 47 (the P7 precondition), 58 (P10 content)
--     restore afbfed86c25e0a62c55163e83ad1f8a7  (identical to the probe baseline)
--
--   P9-twin · `not v_eg` removed from S8, the arm otherwise identical
--     probe   afbfed86c25e0a62c55163e83ad1f8a7 -> 74f6513cb3780603eccfe63f26e0ad46
--     result  5 RED of 72 — tests 54, 56, 57 (P9 locked-case) AND 61, 63 (the locked-case
--             BIT SHAPE). ⭐ That second pair is ADR 0134 Amdt 4 §A4.2's derivation
--             becoming evidence: unbounded, the locked case yields content-without-
--             deliberation and `is_oversight_only_reader` flips TRUE — the collision the
--             bound exists to close, observed in the direction the ADR predicted.
--     restore afbfed86c25e0a62c55163e83ad1f8a7  (identical to the probe baseline)
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
-- 72 -> 78: +2 in §8 (8.1c/8.1d, the second PHI door's precondition + positive control)
-- and +4 in §14 (V-1, the _case_caps strip-and-compare promoted from a recorded check).
select plan(78);

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
select test_helpers.reset_role_and_claims();

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
-- depends on it being NULL. The premise is PINNED here rather than assumed: a pin whose
-- stated premise is false is the same defect as a pin that cannot fail.
-- ⭐ FIXED AT THE ROOT (FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS). This file originally
-- hand-paired each `reset role` with its own claims clear — two lines that can drift apart,
-- and 136 files in this suite pair them nowhere at all. Every such pair here is now the
-- single verb `test_helpers.reset_role_and_claims()`, which does both halves in one call so
-- they CANNOT drift, and whose two halves are independently pinned by
-- `358_unchecked_writers_and_owner_context.sql` §G. 0.5 below stays regardless: the root
-- fix makes the premise true, and 0.5 is what makes it CHECKED.
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
--
-- ⭐ DOMAIN WIDENED TO MATCH THE CLAIM (QA M-7). 2.1/2.2 were bounded to
-- `pronamespace = 'app'` while their description claims the PREDICATE has one body. Those
-- are different statements: a hand-copy of the conjunct list into a `public` routine — the
-- one schema a client can actually reach — satisfied the old assertion and falsified the
-- claim. The bound is now the PROPERTY (any routine anywhere whose comment-stripped body
-- carries BOTH conjunct markers), never a namespace, and 2.2 carries the schema-qualified
-- name so a body that MOVED reds as loudly as one that was copied.
-- ⚠ Measured before widening, not after: over ALL namespaces the count is still 1. A
-- widening that turns up nothing new is evidence the old bound was merely narrow; a
-- widening that quietly required the expected answer would not be.
-- =========================================================================
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'feature_enabled\(''administrativo'''
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'commission_administrativo_capabilities'),
  1, '2.1 ⭐ CATALOG: exactly ONE routine IN THE WHOLE DATABASE carries both the administrativo flag conjunct and the capability table — the predicate has one body, not two. Unbounded by schema, because "one body" is a claim about the predicate, not about `app`');
-- ⛔ 2.2 IS AN ARRAY, NOT A SCALAR SUBQUERY, AND THE REASON IS AN ABORT. As a scalar it
-- read `(select n.nspname||'.'||p.proname from pg_proc where <both markers>)`. The moment a
-- SECOND body exists — the exact event 2.1 exists to catch — that subquery raises
-- "more than one row returned by a subquery used as an expression", which ABORTS the file
-- rather than failing an assertion. ⭐ An abort is not a red: pgTAP reports no plan, and
-- `100_dashboard.sql` has already lost a whole suite that way. The array form fails
-- LOUDLY on the same event and names both bodies in the diagnostic.
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname),
                   array[]::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'feature_enabled\(''administrativo'''
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'commission_administrativo_capabilities'),
  array['app.member_can_for'],
  '2.2 CATALOG: …and it is app.member_can_for, SCHEMA-QUALIFIED (2.1 alone would pass if the one body were the WRONG one, or the RIGHT one relocated to a client-reachable schema)');
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
select test_helpers.reset_role_and_claims();

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
select test_helpers.reset_role_and_claims();
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
select test_helpers.reset_role_and_claims();
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
select test_helpers.reset_role_and_claims();

-- The S3 grantee: st_x2 gets read_case_content + read_standard_phi on case_p.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.grant_case_access(%L, %L, 'read', null, 'P7 positive control', true, false) $$,
         (select case_p from cs), (select st_x2 from k)),
  '8.0b fixture: the coordinator grants st_x2 a READ grant carrying read_standard_phi');
select test_helpers.reset_role_and_claims();

-- ⛔ THE SECOND DOOR'S ARGUMENT IS RESOLVED IN OWNER CONTEXT AND PINNED (QA M-6).
-- 8.2d used to inline `(select cp.participant_id from case_participants … limit 1)`, and
-- that subselect returns NULL when the chain is absent. `get_participant_patient(NULL)`
-- returns NULL as well — measured: its first act is `app.case_of_patient_participant(NULL)`
-- → NULL → `return null`, BEFORE any authority check. So the denial assertion was satisfied
-- whether the subject was refused or simply absent, which is the recorded "a green gate can
-- mean the FIXTURE cannot reach the failing state" shape. 8.1b made the chain LIKELY;
-- nothing asserted it, and unlike 8.2c this door had no positive control of its own.
-- ⚠ Resolved here, in owner context, because `patient_participants` grants `authenticated`
-- NOTHING — the join below is impossible from inside the persona blocks that consume it.
-- ⚠ And resolved by JOINING patient_participants rather than `limit 1` over an unordered
-- case_participants: the old form would have picked an arbitrary participant the day this
-- case acquires a second one, and silently answered about the wrong subject.
create temp table pp on commit drop as
  select cp.participant_id
    from public.case_participants cp
    join public.patient_participants ppx on ppx.participant_id = cp.participant_id
   where cp.case_id = (select case_p from cs) and cp.removed_at is null;
grant select on pp to authenticated;

select is(app.can_read_case_patient((select case_p from cs), (select st_x2 from k)), true,
  '8.1a POSITIVE CONTROL: the S3 grantee holds read_standard_phi');
select isnt((select participant_id from pp), null,
  '8.1c PRECONDITION for the SECOND door: case_p really has a patient participant, so 8.2d''s argument is a real id and not a NULL that the door short-circuits on');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select isnt(public.get_case_patients((select case_p from cs)), null,
  '8.1b ⭐ POSITIVE CONTROL, THROUGH THE DOOR: the grantee reads identifiers from get_case_patients — proving the fixture CAN reach the success state');
select isnt(public.get_participant_patient((select participant_id from pp)), null,
  '8.1d ⭐ POSITIVE CONTROL, SECOND DOOR: the SAME grantee reads identifiers from get_participant_patient with the SAME argument 8.2d uses — so 8.2d''s NULL is a refusal of that principal, not an empty chain. This door had no control of its own; 8.2c had 8.1b and 8.2d had nothing');
select test_helpers.reset_role_and_claims();

select is(app.can_read_case((select case_p from cs), (select st_x from k)), true,
  '8.2a PRECONDITION: the S8 subject CAN read the case''s CONTENT — so 8.2b is a PHI denial, not a case-not-found');
select is(app.can_read_case_patient((select case_p from cs), (select st_x from k)), false,
  '8.2b P7: …and holds NO read_standard_phi. Structural: has_case_capability is a bare bit test with no lattice closure, and only S1/S3 set bit 8');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(public.get_case_patients((select case_p from cs)), null,
  '8.2c ⭐ P7 THROUGH THE DOOR: the S8 subject is refused at the SAME door, on the SAME case, where 8.1b succeeded');
select is(public.get_participant_patient((select participant_id from pp)), null,
  '8.2d P7, SECOND DOOR: get_participant_patient refuses them too, on the SAME participant id where 8.1d succeeded (2 of the 3 doors in the 13.5 property-bounded set are public)');
select test_helpers.reset_role_and_claims();

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
select test_helpers.reset_role_and_claims();
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.assign_case_tag(%L, %L) $$, (select case_o from cs), (select tag_id from tg)),
  '9.3 P8 CONTROL: …while the coordinator succeeds at that same door — so 9.2 is a refusal, not an unreachable door');
select test_helpers.reset_role_and_claims();

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
select test_helpers.reset_role_and_claims();

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
select test_helpers.reset_role_and_claims();
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
--
-- ⭐ NAME-KEYED, NOT COUNT-KEYED (QA M-5). Every assertion here was `count(*) = N`, with
-- the member names sitting in the test DESCRIPTION — and a description is not an
-- assertion. `count(*) = 4` is satisfied by ANY four members: one door leaving the set and
-- another joining it in the same change is exactly the mutation a door-set census exists to
-- catch, and it was the one shape that passed. The shape below is `276` §O5b's
-- (`array_agg(... order by ...)`, from the same delivery), and it FAILS CLOSED in both
-- degenerate directions: `coalesce(..., array[]::text[])` means a regex that stops matching,
-- or a dropped subject, reds instead of passing on a NULL comparison.
--
-- ⛔ THE CONVERSE HAZARD IS REAL AND THIS HEADER IS THE MITIGATION — a rename ORPHANS a
-- name-keyed verdict, and quietly updating the array is the failure the array exists to
-- catch, performed by the person updating it. Convention borrowed verbatim from `321` K8,
-- which handles this correctly. ⛔ IF ANY ASSERTION BELOW GOES RED, ESTABLISH **ADDED vs
-- RENAMED BEFORE YOU TOUCH THE ARRAY**:
--   · RENAMED — the set is unchanged, the label moved. Update the array AND record the old
--     → new name here, as `321` K8 does, so the next reader can tell the two apart.
--   · ADDED — a new surface now keys on the oversight/committee predicates. That is a
--     change in blast radius, needs its own keystone, and is a finding, not an edit.
--   · REMOVED — a consumer stopped gating on it. Establish whether the gate moved or
--     simply went away; the second is the one that matters.
-- ⚠ Names are SCHEMA-QUALIFIED throughout: `public.foo` and `app.foo` are different doors,
-- and only one of them is client-reachable.
-- =========================================================================
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname),
                   array[]::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\yis_oversight_only_reader\y'),
  array['app.can_read_case_committee', 'public.declare_conflict',
        'public.file_correction_request', 'public.record_recusal'],
  '13.1 ⭐ DOOR SET (direct), BY NAME: exactly these 4 routines reference is_oversight_only_reader. A swap — one leaving, one joining — kept the old count(*) = 4 green');
select is(
  (select coalesce(array_agg(c.relname || '.' || pol.polname order by c.relname, pol.polname),
                   array[]::text[])
     from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'')
          ~ '\yis_oversight_only_reader\y'),
  array[]::text[],
  '13.2 DOOR SET: ZERO policies reference it DIRECTLY — which is the number that misleads (see 13.3). Kept as an explicit EMPTY ARRAY, so the assertion states the set rather than a count that any empty result satisfies');
select is(
  (select coalesce(array_agg(c.relname || '.' || pol.polname order by c.relname, pol.polname),
                   array[]::text[])
     from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'')
          ~ '\ycan_read_case_committee\y'),
  array['action_items.action_items_select',
        'case_decisions.case_decisions_select',
        'case_interview_links.case_interview_links_select',
        'case_votes.case_votes_select',
        'ethics_allegations.ethics_allegations_select',
        'ethics_appeals.ethics_appeals_select',
        'ethics_case_details.ethics_case_details_select',
        'ethics_decision_details.ethics_decision_details_select',
        'ethics_findings.ethics_findings_select',
        'ethics_hearings.ethics_hearings_select',
        'ethics_notifications.ethics_notifications_select'],
  '13.3 ⭐ DOOR SET (transitive), BY NAME: its NEGATION can_read_case_committee is referenced by exactly these 11 RLS policies — the real blast radius, which a routine-bounded enumeration hides. Keyed table.policy, because a policy name alone is not unique across tables');
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname),
                   array[]::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\ycan_read_case_committee\y'
      and p.proname <> 'can_read_case_committee'),
  array['app.can_read_action_item', 'app.can_read_interview',
        'app.can_read_professional_profile'],
  '13.4 DOOR SET (transitive), BY NAME: …plus exactly these 3 further routines. app.can_read_professional_profile is the Class-2 professional-identity PHI door — which is WHY the identity matters and a count does not: swap it out for a harmless third routine and the count never moved');
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname),
                   array[]::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\ycan_read_case_patient\y'),
  array['app._audit_access_authorized', 'public.get_case_patients',
        'public.get_participant_patient'],
  '13.5 DOOR SET, BY NAME: the can_read_case_patient door set is exactly these 3 routines, and §8 exercises the 2 `public` ones. This is the set §8''s header bounds itself by, so a count here would let §8''s "both public doors are exercised" claim go stale in silence');

-- =========================================================================
-- (14) V-1 — THE `_case_caps` STRIP-AND-COMPARE, PROMOTED FROM A RECORDED CHECK TO A GATE
-- (QA r2 condition C-3 / the highest-value item in FUP-CS2-QA-RESIDUE).
--
-- `app._case_caps` was re-created WHOLESALE by CREATE OR REPLACE — the single
-- highest-leverage place in this increment for an unintended edit, and the one place the
-- approval scope explicitly FORBIDS touching (no change to S3 / S5 / S7 /
-- is_oversight_only_reader). V-1 settles that by computation rather than by reading a
-- diff: strip the injected S8 block out of the LIVE body and compare what remains.
--
-- ⛔ UNTIL NOW IT WAS A CHECK A HUMAN HAD TO REMEMBER TO RUN. Nothing reddened if a future
-- `_case_caps` change edited S1–S7; the recipe sat in a progress doc and nobody is prompted
-- by a document. This is the pin that makes the NEXT arm's author prove they changed only
-- their own arm.
--
-- ⭐⭐ THE PIN IS ON THE **STRIPPED** HASH, NOT THE LIVE ONE, AND THAT CHOICE IS THE WHOLE
-- DESIGN. `md5(pg_get_functiondef(...)) = '<literal>'` would red on every LEGITIMATE S8
-- edit too — and a constant that reds on legitimate work trains people to bump it on sight,
-- at which point it has stopped being a gate and become a chore. Stripped, it is SILENT
-- about S8 (the arm this file owns and tests behaviourally, §§3–12) and LOUD about
-- everything else. The live hash is deliberately NOT pinned anywhere.
--
-- ⛔ IF 14.3 GOES RED, DO NOT BUMP THE CONSTANT UNTIL YOU KNOW WHICH OF THESE HAPPENED:
--   (a) An arm OUTSIDE S8 was edited. That is the finding. It is outside the approval scope
--       this arm was built under and needs a ruling, not a new hash.
--   (b) A LATER, separately-approved migration legitimately changed S1–S7. Then the
--       constant moves WITH that migration's own review, and this header records the new
--       baseline, the migration that moved it, and why — the way `321` K8 records a rename.
--   (c) The boundary markers themselves moved. 14.1/14.2 red FIRST and tell you that; the
--       hash is then meaningless rather than wrong, and 14.3's red is a consequence.
--
-- ⚠ POSITION CONVENTION, or the next reader chases an off-by-one: both strpos figures are
-- the position of the `\n` PRECEDING the arm marker. Keeping that newline on exactly ONE
-- side of the cut yields the same string — `substring(1, s8-1) ‖ substring(from s3)` and
-- `substring(1, s8) ‖ substring(from s3+1)` hash identically. Cutting it from BOTH sides,
-- or NEITHER, is wrong.
-- ⚠ The marker text is matched BY CODE POINT (`repeat(chr(9472),2)`), so it survives any
-- editor or shell round-trip that would mangle a literal box-drawing character.
-- ⚠ `nullif(...,0)` is load-bearing: a missing marker would otherwise make `substring`
-- raise "negative substring length not allowed" and ABORT the suite, and an abort is not a
-- red. NULL propagates to md5 instead, so 14.3 FAILS rather than vanishing.
--
-- Baseline: docs/progress/case-surface-split-increment-2.md § V-1, re-derived here from the
-- live catalog on a stack whose registered migrations match the tree (440 == 440, head
-- 20261003000800). Boundaries 4406 / 6711; live md5 afbfed86c25e0a62c55163e83ad1f8a7
-- (len 9328, deliberately unpinned); stripped len 7023.
-- =========================================================================
create temp table vv on commit drop as
  with d as (select pg_get_functiondef(p.oid) as def
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'app' and p.proname = '_case_caps'),
       m as (select def,
                    strpos(def, E'\n  -- ' || repeat(chr(9472),2) || ' S8 ') as s8,
                    strpos(def, E'\n  -- ' || repeat(chr(9472),2) || ' S3 ') as s3
               from d)
  select def, s8, s3,
         substring(def from 1 for nullif(s8,0) - 1) || substring(def from nullif(s3,0))
           as stripped
    from m;

select cmp_ok((select s8 from vv), '>', 0,
  '14.1 the S8 arm''s boundary marker is present in the live body — without it the strip has no cut point and 14.3 is meaningless rather than wrong');
select cmp_ok((select s3 from vv), '>', (select s8 from vv),
  '14.2 …and the S3 marker follows it, which is both an existence check (0 fails this) and an ORDER check: the removed span is [S8, S3) and an inverted pair would silently cut the wrong region');
select is(
  (select md5(stripped) from vv),
  'edb85248a21326eb139e7e994b9c469b',
  '14.3 ⭐⭐ V-1: with the S8 arm stripped out, app._case_caps is BYTE-IDENTICAL to its pre-change definition — S1–S7, the S3 loop and STEPS 1–5 were not touched by the wholesale CREATE OR REPLACE. Read the header before bumping this constant');
select ok(
  (select (def ~ '\ymember_can_for\y') and not (stripped ~ '\ymember_can_for\y') from vv),
  '14.4 ⭐ ANTI-VACUITY: the strip actually REMOVED the S8 arm. member_can_for appears in the live body and NOT in the stripped one — so 14.3 is comparing a genuinely cut string, not a no-op strip that happened to hash to the expected value. A neutralization that changes nothing reads exactly like a passing assertion');

select * from finish();
rollback;
