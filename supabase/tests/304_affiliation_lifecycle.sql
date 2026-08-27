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
-- Assertion count: 44 (§6 grew from 1 to 7 when the door-SQLSTATE registry stopped
-- reporting on a hand-maintained list — see §6's header).

begin;
select plan(44);

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
  not has_function_privilege('authenticated', 'public.update_affiliation_for(uuid,uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.update_affiliation_for(uuid,uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean)', 'EXECUTE'),
  '1.2 the _for twin is service_role ONLY — naming the actor stays a service privilege');

select ok(
  has_function_privilege('authenticated', 'public.update_affiliation(uuid,uuid,text,date,boolean,text,text,text,boolean,boolean,boolean)', 'EXECUTE'),
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
-- bodies ARE rewritten at runtime via `pg_get_functiondef` + `replace` + `execute`
-- (ADR 0078 A28). This section is the other end: the RUNNING doors must raise exactly the
-- declared set, so a code that exists only in the catalog cannot hide from both halves.
--
-- ⚠⚠ THIS SECTION ALREADY FAILED ONCE, THE SAME TWO WAYS ITS TS SIBLING DID, and it went
-- green the whole time. Until AFF4 it read:
--   * a HAND-MAINTAINED domain — `proname in ('affiliate_person_impl',
--     'end_affiliation_impl','update_affiliation_impl')` — so it reported on its own list,
--     not on the domain, and AFF4's four new doors were simply absent from it; and
--   * `errcode = '([A-Z0-9]{5})'`, the SYNTAX boundary the TS half had already had to
--     abandon, blind to every NAMED condition (11 live sites raise `check_violation`).
-- Two defects with ONE symptom: fixing only the list would have gone green and stayed
-- blind to names, indistinguishable from a real fix. Both are fixed below.
--
-- ⭐ THE DOMAIN, as a sentence. It INCLUDES every `app` function that is SECURITY DEFINER,
-- VOLATILE, executable by neither `authenticated` nor `service_role` (an owner-only
-- mutation kernel), and called by at least one `public` function that `authenticated` or
-- `service_role` may execute — together with those calling wrappers. It EXCLUDES `app`
-- helpers no client-callable wrapper reaches, the STABLE read/projection helpers behind
-- the same split-ACL shape (they surface through read paths, not through a door's
-- `toState` mapper), trigger functions (never client-callable), and any raise that does
-- not name an errcode — that last exclusion is not taken on trust, §6.2 proves it empty.
--
-- ⛔ Nothing here keys on a NAME. Deriving `app.<x>_impl` from `public.<x>` would have
-- looked identical today and MISSED `public.appoint_technical_director`, a real door that
-- fronts two kernels and shares a base name with neither. §6.1 then pins the reverse
-- direction: no `_impl` kernel escapes the structural domain.
--
-- ⚠ SCOPE, stated because this file is the affiliation suite: the domain is the whole
-- door family, so it also carries the membership-role doors (`HC0G*`, and the `23514`
-- they reach through `check_violation`). That is deliberate — a domain narrowed to
-- "affiliations" can only be narrowed by a name — and it is why this set is WIDER than
-- the affiliation-only set `door-error-arms.test.ts` derives from `actions.ts`. The two
-- halves are not expected to be equal; each must equal its own declared set.
-- ============================================================================

-- Comments stripped before any match: a `--` line or a /* block */ naming a code is not a
-- raise. Stripping (not line-filtering) is deliberate — a line filter drops multi-line
-- disjuncts, a repo-recorded way to under-report a guard.
create or replace function pg_temp.strip_comments(p_src text) returns text
language sql immutable as $strip$
  select regexp_replace(regexp_replace(p_src, '/\*.*?\*/', '', 'gs'), '--.*$', '', 'ng');
$strip$;

-- ⭐ NORMALIZATION WITHOUT A MAPPING TABLE. A caller receives `23514`, never the word
-- `check_violation`, so a named condition must resolve to the SQLSTATE the client
-- actually sees. Postgres itself is asked — raise it and read the state back — so there
-- is no hand-maintained name→code list here to go stale, and no syntax boundary at all:
-- a five-character code passes through the same path unchanged.
--
-- An UNRECOGNISED name FAILS rather than skipping. It cannot be told from a legitimate
-- raise by SQLSTATE (`errcode = 'undefined_object'` and a bogus name both surface 42704),
-- so the discriminator is the MESSAGE: our probe text survives a real raise and is
-- replaced by "unrecognized exception condition" when the name is not one. An unknown
-- name therefore enters the set as a loud `UNKNOWN:<name>` token that can never equal the
-- declared set — the behaviour that stops the domain silently shrinking a third time.
create or replace function pg_temp.door_sqlstate(p_raw text) returns text
language plpgsql as $probe$
declare v_state text; v_msg text;
begin
  begin
    raise exception 'aff-probe' using errcode = p_raw;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  end;
  if v_msg is distinct from 'aff-probe' then return 'UNKNOWN:' || p_raw; end if;
  return v_state;
end $probe$;

create or replace function pg_temp.raised_codes(p_src text) returns setof text
language sql as $codes$
  select distinct pg_temp.door_sqlstate(m[1])
  from regexp_matches(pg_temp.strip_comments(p_src), 'errcode\s*=\s*''([^'']+)''', 'g') m;
$codes$;

create temp table door_body on commit drop as
with client_callable as (
  select n.nspname || '.' || p.proname as fn, p.proname, p.prosrc as src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public' and l.lanname in ('plpgsql', 'sql')
    and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('service_role', p.oid, 'EXECUTE'))
), kernel as (
  select n.nspname || '.' || p.proname as fn, p.proname, p.prosrc as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.prosecdef and p.provolatile = 'v'
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not has_function_privilege('service_role', p.oid, 'EXECUTE')
)
select k.fn, k.src from kernel k
 where exists (select 1 from client_callable w
                where pg_temp.strip_comments(w.src) ~ ('\mapp\.' || k.proname || '\s*\('))
union all
select w.fn, w.src from client_callable w
 where exists (select 1 from kernel k
                where pg_temp.strip_comments(w.src) ~ ('\mapp\.' || k.proname || '\s*\('));

-- 6.1 THE DOMAIN IS NOT ALLOWED TO SHRINK. The structural property decides membership,
-- but the project's door-kernel convention is `app.<x>_impl`; if a kernel carrying that
-- name is NOT reached by the structural derivation, the derivation has a hole (a kernel
-- granted to a client role, or one no client-callable wrapper reaches). Null = none.
select is(
  (select string_agg(p.proname, ',' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname like '%\_impl'
      and 'app.' || p.proname not in (select fn from door_body)),
  null,
  '6.1 ⭐ NO DOOR KERNEL ESCAPES THE DERIVED DOMAIN — every app.*_impl is reached structurally (a hole in the derivation reds here, naming the escapees)');

-- 6.2 THE MATCHER IS NOT ALLOWED TO UNDER-COUNT. An `errcode = v_code` (computed) or a
-- bare `raise exception` with no errcode at all is invisible to any literal match and
-- would leave the client a code this registry never saw. Counting raises against matched
-- literals per body is what makes "every raise is enumerated" a measurement, not a claim.
select is(
  (select string_agg(fn || ' (' || raises || ' raises vs ' || literals || ' literal errcodes)', '; ' order by fn)
     from (select fn,
             (select count(*) from regexp_matches(pg_temp.strip_comments(src), 'raise\s+exception', 'gi')) as raises,
             (select count(*) from regexp_matches(pg_temp.strip_comments(src), 'errcode\s*=\s*''([^'']+)''', 'g')) as literals
             from door_body) x
    where raises <> literals),
  null,
  '6.2 ⭐ every raise in every door body names a LITERAL errcode — a computed errcode or a bare raise (P0001) reds here instead of vanishing from the registry');

-- 6.3 THE EXTRACTOR'S OWN DRY-RUN, over a hand-classified sample carrying a known
-- positive. A detector that finds nothing must be proven able to find something — and the
-- thing the previous version could not find was a NAMED condition. Same code path as the
-- live assertion, so this cannot pass while the real one uses something else.
select is(
  (select string_agg(t.code, ',' order by t.code)
     from pg_temp.raised_codes($sample$
       -- raise exception 'a comment naming HC0Z9' using errcode = 'HC0Z9';
       /* a block comment naming errcode = 'HC0Y1' */
       raise exception 'coded' using errcode = 'HC0R0';
       raise exception 'named' using errcode = 'check_violation';
     $sample$) t(code)),
  '23514,HC0R0',
  '6.3 ⭐ the extractor finds the NAMED condition the old regex was blind to (check_violation -> 23514), keeps five-character codes, and ignores BOTH comment forms');

-- 6.4 …and an unrecognised name is a loud token, never a skip.
select is(
  pg_temp.door_sqlstate('bogus_condition_name'),
  'UNKNOWN:bogus_condition_name',
  '6.4 an unrecognised condition name FAILS into the set rather than dropping out of it silently');

-- 6.5 …and no live door raises one. Split from 6.6 so the diagnosis is readable: this
-- names the offending spelling instead of leaving it buried in a set diff.
select is(
  (select string_agg(distinct t.code, ',' order by t.code)
     from door_body b, pg_temp.raised_codes(b.src) t(code)
    where t.code like 'UNKNOWN:%'),
  null,
  '6.5 no LIVE door raises a condition name Postgres does not recognise');

-- 6.6 THE REGISTRY. Catalog-derived == declared, both directions: a new code reds, and a
-- code that disappeared reds too.
select is(
  (select string_agg(distinct t.code, ',' order by t.code)
     from door_body b, pg_temp.raised_codes(b.src) t(code)),
  -- AE1.3 added `HC0T6` (`registro profissional não encontrado para esta pessoa`,
  -- raised by `app.upsert_credential_impl`'s update branch). It is the ONLY new code:
  -- the six person doors' denials all reuse `42501`, and `23505` propagates from a
  -- constraint rather than being raised by a body, so neither enters this set.
  -- ⛔ `HC0T7` (the person-scope capability tripwire) deliberately does NOT belong here.
  -- It is raised by `app.can_administer_person_for`, which is STABLE and therefore
  -- outside this gate's kernel clause (`provolatile = 'v'`). Declaring it would fail
  -- §6.6 in the OTHER direction — a declared code no in-domain body raises. It is
  -- keystoned directly in pgTAP 384 §7 instead (design §10.3, lead ruling R0).
  '23514,42501,HC0G0,HC0G1,HC0G2,HC0G3,HC0G4,HC0R0,HC0R1,HC0R2,HC0R3,HC0R4,HC0R5,HC0R6,HC0R7,HC0R8,HC0R9,HC0RA,HC0T6',
  '6.6 ⭐ THE RUNNING doors raise exactly the declared SQLSTATE set — the assertion a body rewritten at runtime cannot hide from');

-- 6.7 THE AFF4 REGRESSION PIN. These five had arms in `toState` while BOTH halves of the
-- contract covered none of them. Pinned by name so a domain that silently stops reaching
-- the org-tier doors reds with a message that says which ones went missing, rather than
-- as an anonymous set diff.
select is(
  (select string_agg(x.code, ',' order by x.code)
     from (values ('HC0R6'), ('HC0R7'), ('HC0R8'), ('HC0R9'), ('HC0RA')) x(code)
    where x.code in (select t.code from door_body b, pg_temp.raised_codes(b.src) t(code))),
  'HC0R6,HC0R7,HC0R8,HC0R9,HC0RA',
  '6.7 ⭐ the AFF4 codes are raised by LIVE doors inside the derived domain — the five the previous domain reported on while covering none of them');

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
