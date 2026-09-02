-- 407 — AE4.9 "do now" item 1: the permission resolver's CORRECTED CONTRACT.
-- Subject: 20261003007250 (ADR 0176 D4 / plan § AE4.9, § AE4.4 "Resolver corrections" [IA-F3]).
--
-- ⛔⛔ READ THIS BEFORE TRUSTING A GREEN HERE.
--
-- EVERY assertion in this file was RED before 20261003007250, and five of them were red because
-- the resolver ANSWERED THE OPPOSITE. That is not a claim: §§2 and 4 carry a hand-frozen copy of
-- the PRE-CHANGE (AE4.4b) bodies as `pg_temp.ae44b_*`, and each defect is asserted as a
-- DIFFERENTIAL against it — old says TRUE / new says FALSE, old collapses two cases / new
-- separates them. A suite that only asserted the new behaviour would be green the day it was
-- written and would never have shown that a defect existed at all.
--
-- ⚠ WHY A HAND-WRITTEN COPY OF PRODUCTION TEXT IS LEGITIMATE HERE, AND USUALLY IS NOT. The
-- standing hazard is that a copy of a LIVE body drifts from it silently. These copies are of
-- bodies that were DROPPED by 20261003007250 and can never change again — they are a frozen
-- historical baseline, not a second implementation of anything live. They are never compared to
-- the live body, only to the live ANSWER.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` — same reason as 401: its subject is the
-- real seeded membership population, which bootstrap's `truncate … cascade` would destroy. Every
-- fixture row it creates is removed BY IDENTITY, and the whole file rolls back regardless.
--
-- ⚠ NO `set local role authenticated` ANYWHERE, and that is the security design (401 §16's note):
-- application roles hold NO USAGE on `authz`, so the resolver is unreachable by them. The
-- active-role gate reads request.jwt.claims, which test_helpers.claims_for sets independently of
-- the database role — so these tests exercise the resolver exactly as its DEFINER callers will.
--
-- RUN SHAPE: `Files=2, Tests=55` (54 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a
-- count mismatch.

begin;
select plan(54);

-- ============================================================================
-- §0 — FIXTURE. chefe.ccih is a staff_admin at exactly one commission (401 §16.0's control,
-- repeated because a suite may not depend on another suite's fixture control).
-- ============================================================================
create temp table f407 on commit drop as
  select p.id as uid,
         (select m.commission_id from public.memberships m
           where m.principal_id = p.id and m.role = 'staff_admin' limit 1) as cid
    from public.profiles p where p.email = 'chefe.ccih@test.local';

create temp table f407x on commit drop as
  select (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
           where c.id = (select cid from f407)) as oid,
         -- a commission in a DIFFERENT organization: the genuinely unreachable scope
         (select c.id from public.commissions c join public.hospitals h on h.id = c.hospital_id
           where h.organization_id <> (select h2.organization_id from public.commissions c2
                                        join public.hospitals h2 on h2.id = c2.hospital_id
                                       where c2.id = (select cid from f407))
           limit 1) as fcid,
         -- a sibling commission in the SAME org: needed for §5's two-granting-roles case, because
         -- memberships_one_commission_role_uq forbids two roles at one commission.
         (select c.id from public.commissions c join public.hospitals h on h.id = c.hospital_id
           where h.organization_id = (select h2.organization_id from public.commissions c2
                                        join public.hospitals h2 on h2.id = c2.hospital_id
                                       where c2.id = (select cid from f407))
             and c.id <> (select cid from f407)
           limit 1) as sib_cid;

select is(
  (select count(*)::int from f407, f407x
    where uid is not null and cid is not null and oid is not null
      and fcid is not null and sib_cid is not null),
  1,
  '0.1 FIXTURE CONTROL: one principal, one own commission, one org, one FOREIGN-ORG commission '
  'and one SAME-ORG sibling commission all resolve. ⛔ Every assertion below distinguishes cases '
  'by these coordinates; a NULL would make the distinctions vacuous.');

select is((select r.state::text from authz.roles r where r.code = 'staff_admin'), 'authoritative',
  '0.2 FIXTURE CONTROL: staff_admin is `authoritative` at suite start. §3 flips it and restores '
  'it; if this is wrong the state-gate polarities below are measuring the wrong baseline.');

-- ============================================================================
-- §1 — SHAPE. What the catalog says about the four functions, read from the catalog.
-- ============================================================================

select is(
  (select count(*)::int from unnest(array[
     'authz.has_permission(uuid,text,uuid,text)',
     'authz.candidate_has_permission(uuid,text,uuid,text)',
     'authz.explain_permission(uuid,text,uuid,text)',
     'authz.entailed_grants(uuid,text,uuid,text)']) f
   where to_regprocedure(f) is not null),
  4, '1.1 all four AE4.9 functions exist under their corrected names');

select is(
  (select count(*)::int from unnest(array[
     'authz.has_direct_permission(uuid,text,uuid,text)',
     'authz.explain_direct_permission(uuid,text,uuid,text)']) f
   where to_regprocedure(f) is not null),
  0,
  '1.2 ⭐ THE OLD NAMES ARE GONE, not aliased. Both joined the implication closure, so they '
  'answered ENTAILED and asserted DIRECT (0176 D4). ⛔ A compatibility alias would have kept the '
  'false name reachable, which is the whole thing being corrected.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz'
      and p.proname in ('has_permission','candidate_has_permission','explain_permission','entailed_grants')
      and p.prosecdef and p.proconfig @> array['search_path=""']),
  4,
  '1.3 all four are SECURITY DEFINER with a PINNED empty search_path — the same shape as their '
  'authz siblings, so they inherit the same sweep-arm memberships and introduce no new door '
  'shape. ⛔ prosecdef read from pg_proc, never from the migration text.');

select is(
  (select format_type(a.atttypid, a.atttypmod)
     from pg_attribute a join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'authz' and c.relname = 'permission_explanation' and a.attname = 'denied_reason'),
  'authz.denial_reason',
  '1.4 ⭐ denied_reason CARRIES THE DOMAIN. It was declared `text` while authz.denial_reason sat '
  'unused beside it since 20261003007100 (0176 D4). Typed, an outcome outside the vocabulary '
  'RAISES instead of escaping as free text.');

select is(
  (select array_agg(m[1] order by m[1])
     from regexp_matches(
       (select pg_get_constraintdef(c.oid) from pg_constraint c
         where c.contypid = 'authz.denial_reason'::regtype),
       '''([a-z_]+)''::text', 'g') as m),
  array['granted','permission_not_granted','principal_inactive_or_unassigned',
        'role_not_authoritative','scope_kind_mismatch','scope_unreachable',
        'unknown_permission','wrong_active_role']::text[],
  '1.5 the domain vocabulary is EXACTLY the eight outcomes — the five AE4.4b values plus '
  'scope_kind_mismatch, role_not_authoritative and permission_not_granted. ⛔ Asserted as the '
  'FULL SET rather than "contains", so a ninth outcome added without a decision reds here.');

select throws_ok(
  $$ do $b$ declare v authz.denial_reason; begin v := 'not_a_real_reason'; end $b$ $$,
  '23514', null,
  '1.6 ⭐ VACUITY CONTROL for 1.4/1.5: the domain genuinely REJECTS a value outside the '
  'vocabulary. Without this, "denied_reason is a domain" is a type name and not a control.');

select is(
  (select count(*)::int
     from unnest(array['anon','authenticated','service_role']) r
     cross join unnest(array[
       'authz.has_permission(uuid,text,uuid,text)',
       'authz.candidate_has_permission(uuid,text,uuid,text)',
       'authz.explain_permission(uuid,text,uuid,text)',
       'authz.entailed_grants(uuid,text,uuid,text)']) f
    where has_function_privilege(r, f, 'EXECUTE')),
  0,
  '1.7 ⛔ NO application role holds EXECUTE on ANY of the four (12 probes), by EFFECTIVE '
  'privilege — never proacl text, where a NULL proacl includes PUBLIC. candidate_has_permission '
  'in particular must NEVER be granted: it answers for roles that are not yet authoritative '
  '(0176 D4).');

grant execute on function authz.candidate_has_permission(uuid,text,uuid,text) to anon;
select ok(has_function_privilege('anon', 'authz.candidate_has_permission(uuid,text,uuid,text)', 'EXECUTE'),
  '1.8 VACUITY CONTROL for 1.7: an explicit grant IS observable here, so the twelve falses are '
  'observations and not a stuck predicate');
revoke execute on function authz.candidate_has_permission(uuid,text,uuid,text) from anon;
select ok(not has_function_privilege('anon', 'authz.candidate_has_permission(uuid,text,uuid,text)', 'EXECUTE'),
  '1.9 ...and revoking closes it again');

-- ============================================================================
-- §2 — SCOPE-KIND VALIDATION, AS A DIFFERENTIAL AGAINST THE PRE-CHANGE BODY.
--
-- ⛔ THE PRE-CHANGE DEFECT, MEASURED ON THE LIVE CATALOG AT HEAD 20261003007240 BEFORE THE FIX:
-- `p_scope_kind` appeared NOWHERE in has_direct_permission's body. A commission id passed with
-- kind `hospital` granted; with kind `banana` granted; with NULL granted. An org-scoped code
-- asked at kind `commission` granted. Four accepted-and-ignored polarities.
-- `pg_temp.ae44b_has` below is that body, frozen.
-- ============================================================================

create function pg_temp.ae44b_has(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)
returns boolean language sql stable as $ae44b$
  -- FROZEN COPY of authz.has_direct_permission as it stood at 20261003007170..20261003007240.
  -- Note what is NOT here: any reference at all to p_scope_kind, and any read of authz.roles.state.
  select exists (
    select 1
      from authz.assignment_facts(p_principal) af
      join authz.role_permissions rp on rp.role_code = af.role_code
      join authz.permission_implication_closure cl
        on cl.implying = rp.permission_code and cl.implied = p_permission_code
      join authz.permissions pm on pm.code = p_permission_code
     where authz.scope_reaches(af.scope_kind, af.scope_id, pm.resolution_scope_kind::text, p_scope_id)
       and (p_principal is distinct from (select auth.uid())
            or af.role_code is not distinct from app.active_role())
  );
$ae44b$;

select ok(authz.has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '2.1 POSITIVE: the CORRECT kind for a commission-scoped code still grants. ⛔ Stated first '
  'because a validation that denies everything also passes every negative below.');

select ok(pg_temp.ae44b_has((select uid from f407), 'hospital', (select cid from f407), 'commission.forms.edit'),
  '2.2 ⭐ THE DEFECT, REPRODUCED: the PRE-CHANGE body grants a commission id passed with kind '
  '`hospital`. This is the anchor — 2.3''s FALSE means something only because this is TRUE.');

select ok(not authz.has_permission((select uid from f407), 'hospital', (select cid from f407), 'commission.forms.edit'),
  '2.3 ⭐⭐ ...and the CORRECTED resolver DENIES it. A wrong-but-plausible kind is the dangerous '
  'one: it is what a caller writes by accident and what an attacker writes on purpose.');

select ok(pg_temp.ae44b_has((select uid from f407), 'banana', (select cid from f407), 'commission.forms.edit'),
  '2.4 ⭐ THE DEFECT, REPRODUCED on a NONSENSE kind: the pre-change body grants `banana` too, '
  'because the parameter was never read at all.');

select ok(not authz.has_permission((select uid from f407), 'banana', (select cid from f407), 'commission.forms.edit'),
  '2.5 ...and the corrected resolver denies a kind that is not even in the vocabulary');

select ok(not authz.has_permission((select uid from f407), null, (select cid from f407), 'commission.forms.edit'),
  '2.6 ⭐ NULL FAILS CLOSED. `is distinct from` was chosen precisely so a NULL kind cannot slip '
  'past as "no constraint expressed".');

select ok(authz.has_permission((select uid from f407), 'organization', (select oid from f407x), 'org.professionals.read'),
  '2.7 POSITIVE, org side: an ORG-scoped code at the correct kind still grants through a '
  'COMMISSION-scoped assignment — 401 §16.6''s ASCENT is preserved, not collateral damage.');

select ok(not authz.has_permission((select uid from f407), 'commission', (select oid from f407x), 'org.professionals.read'),
  '2.8 ⭐ ...and the same code asked at kind `commission` is DENIED, where the pre-change body '
  'granted it (2.9 anchors that).');

select ok(pg_temp.ae44b_has((select uid from f407), 'commission', (select oid from f407x), 'org.professionals.read'),
  '2.9 ⭐ THE DEFECT, REPRODUCED on the org side, so 2.8 is a change and not a coincidence');

select is((authz.explain_permission((select uid from f407), 'hospital', (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  'scope_kind_mismatch',
  '2.10 the explanation NAMES the gate that denied — a new outcome in the DOMAIN, not free text');

select is((authz.explain_permission((select uid from f407), null, (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  'scope_kind_mismatch', '2.11 ...including the NULL-kind case');

select ok(not authz.candidate_has_permission((select uid from f407), 'hospital', (select cid from f407), 'commission.forms.edit'),
  '2.12 ⭐ THE CANDIDATE EVALUATOR VALIDATES THE KIND TOO. The oracle and the runtime path must '
  'differ ONLY in the state gate; a candidate that skipped this would be differentialling a '
  'contract the runtime does not have.');

-- ============================================================================
-- §3 — THE STATE GATE, and the proof that the split is REAL rather than a rename.
--
-- ⛔ THE PRE-CHANGE DEFECT: the resolver did not read authz.roles.state AT ALL. Measured with
-- staff_admin flipped to `legacy`: authz.holds_role (layer 1, 0174 D2's gate) answered FALSE
-- while has_direct_permission answered TRUE — the two layers disagreed about the same role.
-- ============================================================================

select ok(pg_temp.ae44b_has((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.0 baseline for the frozen body (authoritative): TRUE. Needed so 3.4''s "still TRUE under '
  'legacy" is attributable to the missing state gate and not to the fixture.');

select ok(authz.has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.1 AUTHORITATIVE / RUNTIME: grants');
select ok(authz.candidate_has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.2 AUTHORITATIVE / CANDIDATE: grants — the two agree wherever the state is authoritative, '
  'which is why pointing the AE4.5 differential at the candidate loses nothing today');

update authz.roles set state = 'test_validation' where code = 'staff_admin';

select ok(not authz.has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.3 ⭐⭐ TEST_VALIDATION / RUNTIME: FAILS CLOSED. The runtime evaluator requires '
  '`authoritative` (0176 D4).');
select ok(authz.candidate_has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.4 ⭐⭐ TEST_VALIDATION / CANDIDATE: STILL ANSWERS. ⛔ THIS IS THE ASSERTION THAT MAKES THE '
  'SPLIT REAL RATHER THAN A RENAME — same principal, same scope, same code, same instant, two '
  'function identities, two answers. `test_validation` is the ONLY state where they differ, so '
  'it is the only state that can prove the split exists.');
select is((authz.explain_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  'role_not_authoritative',
  '3.5 ⭐ ...and the explanation says WHY, distinctly. Before AE4.9 this outcome did not exist '
  'and an operator would have read `scope_unreachable` and gone looking for a tenancy bug.');
select ok(pg_temp.ae44b_has((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.6 ⭐ THE DEFECT, REPRODUCED: the pre-change body grants regardless of state, so 3.3 is a '
  'behaviour change and not a fixture accident.');

update authz.roles set state = 'legacy' where code = 'staff_admin';

select ok(not authz.has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.7 LEGACY / RUNTIME: denies');
select ok(not authz.candidate_has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.8 ⭐ LEGACY / CANDIDATE: ALSO denies, and that is deliberate. A `legacy` role''s catalog '
  'mapping has not been ratified, so an oracle that read it would be differentialling an '
  'unapproved mapping and calling the result agreement. The pre-cutover sequence is '
  'legacy -> test_validation -> authoritative; the oracle joins at the middle state.');
select ok(not authz.holds_role((select uid from f407), 'staff_admin', 'commission', (select cid from f407)),
  '3.9 ⭐ LAYER 1 AGREES. authz.holds_role has gated on `authoritative` since 0174 D2; the '
  'resolver did not, so the two layers disagreed about the same role under `legacy`. They now '
  'answer the same. ⛔ This is the seam 0176 exists to close.');

update authz.roles set state = 'authoritative' where code = 'staff_admin';

select ok(authz.has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '3.10 RESTORED: the runtime evaluator grants again. ⛔ Without this, 3.3/3.7 could be a '
  'one-way latch — a resolver that broke on the first UPDATE and never recovered.');

-- ============================================================================
-- §4 — `permission_not_granted` IS A DISTINCT OUTCOME.
--
-- ⛔ THE PRE-CHANGE DEFECT: reachability was computed ONLY through rows that already grant, so a
-- DELETED GRANT and a GENUINELY FOREIGN SCOPE produced the SAME string. Measured before the fix,
-- both `scope_unreachable`. The explanation was wrong in the one case an operator most needs it.
-- `pg_temp.ae44b_reason` is that logic, frozen.
-- ============================================================================

create function pg_temp.ae44b_reason(p_principal uuid, p_scope_id uuid, p_permission_code text)
returns text language plpgsql stable as $ae44b$
declare v_res text;
begin
  -- FROZEN COPY of explain_direct_permission's denial branch (20261003007170).
  select pm.resolution_scope_kind::text into v_res from authz.permissions pm where pm.code = p_permission_code;
  if v_res is null then return 'unknown_permission'; end if;
  if not exists (select 1 from authz.assignment_facts(p_principal)) then
    return 'principal_inactive_or_unassigned';
  end if;
  if exists (select 1 from authz.assignment_facts(p_principal) af
               join authz.role_permissions rp on rp.role_code = af.role_code
               join authz.permission_implication_closure cl
                 on cl.implying = rp.permission_code and cl.implied = p_permission_code
              where authz.scope_reaches(af.scope_kind, af.scope_id, v_res, p_scope_id))
  then return 'wrong_active_role'; else return 'scope_unreachable'; end if;
end $ae44b$;

select is((authz.explain_permission((select uid from f407), 'commission', (select fcid from f407x), 'commission.forms.edit')).denied_reason::text,
  'scope_unreachable',
  '4.1 CASE A — a FOREIGN-ORG commission: the scope really is unreachable, and that is what it '
  'says. Unchanged by AE4.9, and stated so 4.3 is a separation rather than a relabel.');

delete from authz.role_permissions
 where role_code = 'staff_admin' and permission_code = 'commission.forms.edit';

select is(pg_temp.ae44b_reason((select uid from f407), (select cid from f407), 'commission.forms.edit'),
  'scope_unreachable',
  '4.2 ⭐ THE COLLAPSE, REPRODUCED: with the grant DELETED and the principal standing in her OWN '
  'commission, the pre-change logic reports the SCOPE as unreachable. Same string as 4.1, two '
  'completely different situations.');

select is((authz.explain_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  'permission_not_granted',
  '4.3 ⭐⭐ ...and the CORRECTED explanation separates them. Reachability is now computed with NO '
  'permission join at all, so "you have no such grant" and "that scope is unreachable for you" '
  'are different answers (0176 D4).');

select isnt(
  (authz.explain_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  (authz.explain_permission((select uid from f407), 'commission', (select fcid from f407x), 'commission.forms.edit')).denied_reason::text,
  '4.4 ⭐ THE SEPARATION ASSERTED DIRECTLY, not inferred from two expected strings: the two '
  'constructed cases explain DIFFERENTLY, in the same transaction, with the same principal.');

select ok(not authz.has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '4.5 DECISION CONTROL: with the grant deleted the resolver also DENIES. ⛔ The explanation is '
  'diagnostic; if the decision had not moved, 4.3 would be describing a denial that never '
  'happened.');

insert into authz.role_permissions (role_code, permission_code)
  values ('staff_admin', 'commission.forms.edit');

select is((authz.explain_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  'granted', '4.6 RESTORED: re-inserting the grant returns the outcome to `granted`');

select is((authz.explain_permission((select uid from f407), 'commission', (select cid from f407), 'no.such.code')).denied_reason::text,
  'unknown_permission', '4.7 an unknown code is reported as such, not as a denial');

select is((authz.explain_permission('00000000-0000-0000-0000-000000000000', 'commission', (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  'principal_inactive_or_unassigned',
  '4.8 a principal with NO assignment facts is reported as such — the third distinct denial, '
  'ahead of both scope and grant questions in the stated precedence');

select test_helpers.claims_for((select uid from f407), false, 'staff');
select is((authz.explain_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit')).denied_reason::text,
  'wrong_active_role',
  '4.9 ⭐ AND THE HAT REMAINS ITS OWN OUTCOME. A SELF-check with the `staff` hat on: she still '
  'holds the permission through staff_admin, the scope is reachable, the grant exists — only the '
  'hat blocks. ⛔ If this had collapsed into `permission_not_granted`, §4''s new outcome would '
  'have been bought by breaking an existing distinction.');
select test_helpers.reset_role_and_claims();

-- ============================================================================
-- §5 — DETERMINISTIC EXPLANATION. The pre-change body used `limit 1` with NO `order by`, so two
-- identical calls could name different granting roles. The precedence is now STATED in the
-- function's comment: lowest role_code, then lowest granting_permission_code, `C` collation.
-- ⛔ A single-granting-path fixture CANNOT test this — there is nothing to order. §5 constructs
-- the two-path case on purpose.
-- ============================================================================

insert into public.memberships (principal_id, commission_id, role)
  values ((select uid from f407), (select sib_cid from f407x), 'staff');
insert into authz.role_permissions (role_code, permission_code)
  values ('staff', 'org.professionals.read');
update authz.roles set state = 'authoritative' where code = 'staff';

select is(
  (select count(distinct eg.role_code)::int
     from authz.entailed_grants((select uid from f407), 'organization', (select oid from f407x),
                                'org.professionals.read') eg
    where eg.role_state = 'authoritative' and eg.hat_ok),
  2,
  '5.1 FIXTURE CONTROL: TWO distinct roles now entail the same code at the same coordinate '
  '(staff@sibling and staff_admin@ccih, both ascending to the same org). ⛔ Without this the '
  'ordering assertion below would pass over a one-row result and prove nothing.');

select is(
  (authz.explain_permission((select uid from f407), 'organization', (select oid from f407x),
                            'org.professionals.read')).granting_role_code,
  'staff',
  '5.2 ⭐⭐ THE STATED PRECEDENCE IS THE ONE OBSERVED: with two granting roles the explanation '
  'reports the LOWEST role_code under `C` collation (`staff` < `staff_admin`). ⛔ Under the '
  'pre-change `limit 1` with no `order by` this was whichever row the plan happened to emit '
  'first — an unstated precedence, which 0176 D4 forbids.');

select is(
  (authz.explain_permission((select uid from f407), 'organization', (select oid from f407x), 'org.professionals.read')).granting_role_code,
  (authz.explain_permission((select uid from f407), 'organization', (select oid from f407x), 'org.professionals.read')).granting_role_code,
  '5.3 ...and two calls in the same statement agree. ⚠ Weak on its own (a stable plan satisfies '
  'it too) — 5.2 is the assertion with content; this only catches a nondeterminism 5.2''s single '
  'sample could miss.');

select ok(
  (authz.explain_permission((select uid from f407), 'organization', (select oid from f407x), 'org.professionals.read')).granted,
  '5.4 ...and the two-path case still GRANTS — the ordering narrows which path is reported, '
  'never whether the answer is yes.');

update authz.roles set state = 'legacy' where code = 'staff';
delete from authz.role_permissions where role_code = 'staff' and permission_code = 'org.professionals.read';
delete from public.memberships
 where principal_id = (select uid from f407) and commission_id = (select sib_cid from f407x) and role = 'staff';

select is((select count(*)::int from public.memberships
            where principal_id = (select uid from f407) and role = 'staff'), 0,
  '5.5 CLEANUP CONTROL: §5''s constructed membership is removed BY IDENTITY. ⛔ A positional '
  'cleanup here would eat seed rows that ~900 other tests depend on.');

-- ============================================================================
-- §6 — THE SHARED JOIN IS LOAD-BEARING FOR ALL THREE CONSUMERS.
--
-- authz.entailed_grants exists so the entailment join has ONE copy. That is a claim about
-- coupling, and a comment cannot hold it: neutralise the helper's scope check and ALL THREE
-- consumers must move together. This is also the mutation-proven keystone the runtime evaluator
-- and the explanation would otherwise lack (403 §6.3 only ever mutated one function).
-- ============================================================================

select ok(not authz.has_permission((select uid from f407), 'commission', (select fcid from f407x), 'commission.forms.edit'),
  '6.0 PRE-MUTATION BASELINE: the foreign-org commission is denied by the runtime evaluator');

create or replace function authz.entailed_grants(
  p_principal uuid, p_resolution_kind text, p_scope_id uuid, p_permission_code text
) returns table (role_code text, granting_permission_code text, role_state text, hat_ok boolean)
language sql stable security definer set search_path = '' as $neut$
  -- NEUTRALISED: authz.scope_reaches removed. Everything else identical.
  select af.role_code, rp.permission_code, r.state::text,
         (p_principal is distinct from (select auth.uid())
          or af.role_code is not distinct from app.active_role())
    from authz.assignment_facts(p_principal) af
    join authz.roles r on r.code = af.role_code
    join authz.role_permissions rp on rp.role_code = af.role_code
    join authz.permission_implication_closure cl
      on cl.implying = rp.permission_code and cl.implied = p_permission_code;
$neut$;

select ok(authz.has_permission((select uid from f407), 'commission', (select fcid from f407x), 'commission.forms.edit'),
  '6.1 ⭐⭐ WITH scope_reaches REMOVED FROM THE SHARED HELPER, the RUNTIME evaluator grants a '
  'FOREIGN ORGANIZATION''s commission. ⛔ That is an org-wide over-grant, and it proves this '
  'suite measures SCOPE and not merely grants.');
select ok(authz.candidate_has_permission((select uid from f407), 'commission', (select fcid from f407x), 'commission.forms.edit'),
  '6.2 ...and so does the CANDIDATE evaluator — the two consumers share one copy of the join, '
  'asserted rather than asserted-in-a-comment');
select is((authz.explain_permission((select uid from f407), 'commission', (select fcid from f407x), 'commission.forms.edit')).denied_reason::text,
  'scope_unreachable',
  '6.3 ⭐⭐ ...and THE EXPLANATION DOES NOT MOVE, which is the point. Its reachability check runs '
  'over authz.assignment_facts + authz.scope_reaches DIRECTLY, with NO permission join, so '
  'breaking the join cannot move it. ⛔ That independence is exactly what 0176 D4 required and '
  'what AE4.4b did not have — there, reachability was READ OFF the granting query, so this '
  'mutation would have flipped the explanation too. ⚠ Decision and explanation therefore '
  'DISAGREE while the helper is neutralised; that is a property of the mutation, not of the '
  'design, and it is what makes the two computations demonstrably separate.');

create or replace function authz.entailed_grants(
  p_principal uuid, p_resolution_kind text, p_scope_id uuid, p_permission_code text
) returns table (role_code text, granting_permission_code text, role_state text, hat_ok boolean)
language sql stable security definer set search_path = '' as $restore$
  select af.role_code, rp.permission_code, r.state::text,
         (p_principal is distinct from (select auth.uid())
          or af.role_code is not distinct from app.active_role())
    from authz.assignment_facts(p_principal) af
    join authz.roles r on r.code = af.role_code
    join authz.role_permissions rp on rp.role_code = af.role_code
    join authz.permission_implication_closure cl
      on cl.implying = rp.permission_code and cl.implied = p_permission_code
   where authz.scope_reaches(af.scope_kind, af.scope_id, p_resolution_kind, p_scope_id);
$restore$;

select ok(not authz.has_permission((select uid from f407), 'commission', (select fcid from f407x), 'commission.forms.edit'),
  '6.4 ⛔ THE RESTORE IS PROVEN, not assumed: the foreign commission is denied again. A mutation '
  'harness that cannot show its rollback landed has measured nothing.');
select ok(authz.has_permission((select uid from f407), 'commission', (select cid from f407), 'commission.forms.edit'),
  '6.5 ...and the ordinary positive still holds after the restore, so §6 left the resolver '
  'exactly as it found it. ⚠ The whole file rolls back regardless; this is about the assertions '
  'that run BETWEEN here and the rollback.');

select * from finish();
rollback;
