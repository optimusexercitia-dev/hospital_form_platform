-- AFF2 B3 — `list_org_people` payload gains `date_of_birth`. ADR 0133 D11, as corrected by
-- Amendment 1 ruling 4 (DOB has TWO read paths; phone has one). Migration 20261003001200.
--
-- ⛔ THIS DOOR COULD NOT BE `CREATE OR REPLACE`d. Adding a column to a `RETURNS TABLE`
-- CHANGES THE RETURN TYPE, which `CREATE OR REPLACE FUNCTION` refuses outright. It was a
-- `DROP FUNCTION` + `CREATE`, and a DROP silently discards FOUR things that a "the body is
-- right" review would never look at:
--   1. The ACL — and it fails open in the direction no ordinary test notices, because
--      every "can authenticated execute?" assertion passes MORE easily afterwards.
--      ⛔ MEASURED, and NOT the way the standing lore says: the DROP+CREATE does NOT leave
--      `proacl` NULL here. It leaves it POPULATED and containing PUBLIC (`=X/postgres`),
--      which `anon` inherits. So the natural `proacl is not null` assertion is GREEN on the
--      fail-open state. §2.1 is an exact acl differential for that reason — full note there.
--   2. `SECURITY DEFINER` — if `prosecdef` came back false the door would become INVOKER,
--      its inline gate would stop replacing RLS, and every ACL and payload assertion here
--      would still be green. §5.1.
--   3. The pinned `SET search_path`. §5.2.
--   4. The COMMENT (five lines of ADR 0097 D10/D11 rationale). §5.3.
-- Anything the DROP destroyed and the CREATE did not restore is a silent regression, so
-- each of the four is asserted separately rather than inferred from "the function exists".
--
-- ⛔ THE BODY WAS RE-EMITTED FROM THE LIVE `pg_get_functiondef`, never from migration text
-- (stale by design here: some migrations rewrite bodies at runtime via
-- `pg_get_functiondef` + `replace` + `execute`, so no file can be trusted to match). §5 and
-- §6 are what prove the re-emission preserved the door rather than approximating it.
--
-- ⚠ FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE was SWEPT before the drop and is
-- ARMED BUT NOT TRIGGERED. The only executable signature string naming this door is
-- `302_affiliation_doors.sql:79` — `'public.list_org_people(uuid,text,text)'` — and B3
-- changes the RETURN type only, leaving the argument list identical, so it keeps resolving.
-- 1.2 pins the exact `regprocedure` text (the same string form `has_function_privilege`
-- consumes) so a FUTURE arity change reds HERE, beside this explanation, instead of
-- aborting an unrelated suite with a bare "Bad plan" that names no function.
--
-- ⚠ `phone` is deliberately NOT in this payload (D11: it differentiates nothing in a
-- homonym match). 3.2 pins its absence, because "we just didn't add it" is not a control.

begin;
select plan(24);

-- The single OID, resolved once. Every structural assertion below keys off THIS row rather
-- than a `like 'list_org_people%'` pattern: the LIKE form silently fuses two overloads into
-- one answer, which is the precise failure a DROP+CREATE can introduce.
create temp table d on commit drop as
  select p.oid,
         p.oid::regprocedure::text as sig,
         p.proname || '_' || p.oid::text as specific_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'list_org_people';

-- ===========================================================================
-- §1 Exactly ONE door, at exactly the expected signature.
-- ===========================================================================
select is(
  (select count(*)::int from d), 1,
  '1.1 ⭐ EXACTLY ONE `list_org_people` exists. A DROP+CREATE whose CREATE used a different argument type (e.g. `extensions.citext`, which the AFF2 plan wrongly prescribed) would leave an ungranted, un-audited TWIN beside the real door that PostgREST might resolve to');

-- ⭐ THE TRAP FIRED, AND IT FIRED WHERE IT WAS SUPPOSED TO (AFF4 B6a, 2026-08-26). The
-- header above said a FUTURE arity change would red HERE, beside the explanation, instead
-- of aborting an unrelated suite. B6a added `p_include_ended boolean` and that is exactly
-- what happened: this assertion reds, and the one executable signature string it points at
-- (`302_affiliation_doors.sql`) was updated in the same change.
select is(
  (select sig from d), 'list_org_people(uuid,text,text,boolean)',
  '1.2 ⭐ ... at the exact signature, pinned as `oid::regprocedure::text` — the SAME string form has_function_privilege takes, so this matches the FUP-SIGNATURE-STRING-CALLERS hazard rather than approximating it. The three leading args are pg_catalog.text; there is no citext here');

-- ===========================================================================
-- §2 The ACL the DROP destroyed, restored — asserted from the catalog, not from
-- the migration's GRANT statements.
-- ===========================================================================
-- ⛔ MEASURED CORRECTION (2026-08-23, scratch-transaction control run before writing the
-- migration). The build brief said "a DROP resets `proacl` to NULL, which means PUBLIC",
-- and an `ok(proacl is not null)` assertion follows naturally from it. THAT ASSERTION IS
-- VACUOUS IN THIS DATABASE. Measured: a fresh `create function` in `public` here yields
--     =X/postgres | postgres=X/postgres | service_role=X/postgres
-- — NOT NULL, and the leading `=X/postgres` (empty grantee) IS the PUBLIC grant, so `anon`
-- can execute. The security consequence is identical to the NULL case; the DETECTOR is not.
-- `proacl is not null` goes GREEN on exactly the fail-open state it was written to catch.
--
-- So 2.1 is an EXACT DIFFERENTIAL against the measured pre-DROP acl instead. It reds three
-- different ways — a NULL acl, an acl that gained PUBLIC or anon, and an acl that LOST
-- service_role — where the `is not null` form reds on only one of them, and not the one
-- that actually happens.
select is(
  (select array(select unnest(p.proacl)::text order by 1) from pg_proc p join d on d.oid = p.oid),
  array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres'],
  '2.1 ⭐ the acl matches the measured pre-DROP set EXACTLY — no PUBLIC entry, no anon, and service_role still present. An exact differential, because `proacl is not null` is GREEN on the fail-open state (see the note above)');

select ok(
  not has_function_privilege('public', (select oid from d), 'EXECUTE'),
  '2.2 PUBLIC cannot execute (the standing t19 trap: a freshly CREATEd public.* function carries a PUBLIC EXECUTE entry — REVOKE must precede GRANT). CONTROL-PROVEN: this predicate was evaluated against an unREVOKEd throwaway function and returned false');

select ok(
  not has_function_privilege('anon', (select oid from d), 'EXECUTE'),
  '2.3 ⭐ ... and neither can `anon`, asserted directly rather than inferred from 2.2. anon is what a PUBLIC grant actually leaks to, and it is the role a reader cares about — measured at t on the unREVOKEd control');

select ok(
  has_function_privilege('authenticated', (select oid from d), 'EXECUTE')
  and has_function_privilege('service_role', (select oid from d), 'EXECUTE'),
  '2.4 ... and BOTH `authenticated` and `service_role` still can. service_role is named explicitly: it was in the measured pre-DROP acl, and a restore step that only re-grants `authenticated` narrows the door silently');

-- ===========================================================================
-- §3 The payload. `date_of_birth` in; `phone` and `cpf` out.
-- ===========================================================================
select is(
  (select count(*)::int from information_schema.parameters
    where specific_schema = 'public'
      and specific_name = (select specific_name from d)
      and parameter_mode = 'OUT' and parameter_name = 'date_of_birth'), 1,
  '3.1 ⭐ D11: `date_of_birth` IS in the returned payload');

select is(
  (select count(*)::int from information_schema.parameters
    where specific_schema = 'public'
      and specific_name = (select specific_name from d)
      and parameter_mode = 'OUT' and parameter_name in ('phone', 'cpf')), 0,
  '3.2 ⭐ ... and NEITHER `phone` NOR `cpf` is. phone differentiates nothing in a homonym match (D11); cpf is an exact-match INPUT that must never be returned (D12 / the CPF existence oracle)');

select is(
  (select count(*)::int from information_schema.parameters
    where specific_schema = 'public'
      and specific_name = (select specific_name from d)
      and parameter_mode = 'OUT'), 9,
  '3.3 the payload is EXACTLY 9 columns — the 6 that existed, plus date_of_birth (AFF2 B3), plus org_affiliation_status and org_affiliation_ended_on (AFF4 B6a). A count, so a column smuggled in beside them reds here rather than shipping; it went 7 -> 9 at B6a, and §3.2 is what keeps `cpf`/`phone` out of the widening');

-- ===========================================================================
-- §4 Functional: the value actually flows. §3 proves the signature; a signature
-- is not a value, and the SELECT list could still omit the column.
-- ===========================================================================
-- Written on the service path (auth.uid() null), which is the only way to set this value
-- at all. ⚠ AE3 (ADR 0155 D4) MOVED IT: the column left `profiles` for
-- `profile_private_details`, and the refusal is now the ABSENT GRANT on that table rather
-- than the B1 guard arm (which retired with the column). 359 asserts that swap; this file
-- only needs the value on the service path, which is unchanged.
--
-- ⛔ UPSERT, NOT UPDATE. The seed gives this persona a `profile_private_details` row (it
-- has a CPF), but that is a fact about the seed, not about this file. A bare UPDATE against
-- a missing row writes nothing AND RAISES NOTHING, so 4.1 would fail with a null and read
-- as "the door stopped returning the column" — a fixture gap wearing the costume of a
-- product defect.
insert into public.profile_private_details (profile_id, date_of_birth)
values ('00000000-0000-0000-0000-0000000000d1', '1979-04-11')
on conflict (profile_id) do update set date_of_birth = excluded.date_of_birth;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1');
set local role authenticated;

select is(
  (select date_of_birth::text from public.list_org_people('0c000000-0000-0000-0000-00000000000a')
    where user_id = '00000000-0000-0000-0000-0000000000d1'), '1979-04-11',
  '4.1 ⭐ THE B3 KEYSTONE: a hospital_admin''s directory call returns the actual birth date. Amdt 1 ruling 4 requires exactly this reach — the colliding homonym is typically at ANOTHER hospital, so the door''s gate (org_admin OR any hospital_admin of the org) is the right one');

-- ⛔ HARDENED 2026-08-23 after a measured contamination. This was
--     `count(*) ... where date_of_birth is null) > 0`
-- — an unscoped existence check over the whole org roster, and a concurrent E2E run
-- inserted 10 people into THIS org, every one of them NULL-DOB. The assertion was
-- therefore satisfiable by ambient traffic: it would have passed even if the door had
-- dropped every genuinely-null row, which is the exact regression it exists to catch.
-- Now anchored on a NAMED seed persona, so only the door's behaviour can move it.
select is(
  (select count(*)::int from public.list_org_people('0c000000-0000-0000-0000-00000000000a')
    where user_id = '00000000-0000-0000-0000-000000000002'), 1,
  '4.2 ⭐ a NAMED person with no birth date is still RETURNED (chefe.ccih, DOB never set). An inner join to a DOB source, or a filter that dropped null rows, would silently shrink the whole directory');

select ok(
  (select date_of_birth is null from public.list_org_people('0c000000-0000-0000-0000-00000000000a')
    where user_id = '00000000-0000-0000-0000-000000000002'),
  '4.3 ... and their date_of_birth comes back NULL, not an empty string or a zero date — the column is optional (D9) and 4.1''s non-null value proves the other side of the pair');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §5 The four things the DROP destroyed.
-- ===========================================================================
select ok(
  (select p.prosecdef from pg_proc p join d on d.oid = p.oid),
  '5.1 ⭐ `prosecdef` is STILL TRUE. If the CREATE had lost SECURITY DEFINER the door would become INVOKER, its inline gate would stop replacing RLS — and §1, §2, §3 and §6 would ALL still be green. This is the assertion that catches it');

select ok(
  (select p.proconfig::text like '%search_path%' from pg_proc p join d on d.oid = p.oid),
  '5.2 ... and the pinned `SET search_path` survived (a DEFINER function without one is the classic search-path hijack)');

select ok(
  (select obj_description(d.oid, 'pg_proc') from d) like '%ADR 0097%',
  '5.3 ... and the COMMENT survived. `DROP FUNCTION` discards it silently; five lines of gate rationale would otherwise vanish with nothing to notice');

select ok(
  (select obj_description(d.oid, 'pg_proc') from d) like '%date_of_birth%',
  '5.4 ... and the comment was UPDATED for D11, not merely restored verbatim — the payload changed, so a comment that still described the old one would be a fresh stale-record instance');

-- ===========================================================================
-- §6 The GATE still bites, and the AUDIT path is untouched. A re-emitted body is
-- exactly where a gate clause gets dropped in transcription.
-- ===========================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000f3');
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people('0c000000-0000-0000-0000-00000000000a')), 0,
  '6.1 ⭐ DISTINGUISHING: a `quality_reviewer`-hatted caller in the SAME org reads NOTHING. The inline gate admits org_admin or an ACTIVE-hatted hospital_admin only, and this persona is neither — proving the re-emission kept the gate rather than returning the roster to any authenticated caller');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003');
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people('0c000000-0000-0000-0000-00000000000a')), 0,
  '6.2 ... and a plain commission member reads nothing either (empty, never an error — a probe must not distinguish "none" from "not allowed")');
select test_helpers.reset_role_and_claims();

-- ⚠ BASELINE FIRST. `audit_log` is SHARED and APPEND-ONLY and this suite runs against the
-- persisted seed, so an absolute count silently counts rows this transaction did not
-- create — a dev server on the same local database is enough to red it (302 §5 records
-- catching exactly that).
create temp table cpf_audit_before on commit drop as
  select id from public.audit_log where action = 'person.cpf_lookup';

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1');
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people(
     '0c000000-0000-0000-0000-00000000000a', null, '12345678909')), 1,
  '6.3 the CPF exact-match path still resolves a person (the D12 identifier-first branch the wizard depends on)');
select test_helpers.reset_role_and_claims();

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)), 1,
  '6.4 ⭐ the audited CPF probe is UNTOUCHED: that call emitted exactly ONE person.cpf_lookup row (D11 / audit LOW-2)');

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)
      and (metadata::text like '%12345678909%' or summary like '%12345678909%')), 0,
  '6.5 ... and it carries NO CPF digits (Rule 11: the log records THAT and WHO, never the payload)');

select ok(
  (select bool_and(actor_id = '00000000-0000-0000-0000-0000000000e1') from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)),
  '6.6 ... and it names the ACTOR — which is why this door runs on the cookie client, not the service client');

-- The twin that makes 6.4's "1" attributable. Without it, one row is indistinguishable
-- from one row of ambient traffic, and a body that audited EVERY call would pass 6.4.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1');
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.list_org_people(
     '0c000000-0000-0000-0000-00000000000a', 'Novato')), '>', 0,
  '6.7 a NAME search still returns results');
select test_helpers.reset_role_and_claims();

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)), 1,
  '6.8 ⭐ VACUITY CONTROL for 6.4: the name search emitted NO audit row — still exactly 1 in total. Only CPF lookups are logged, so 6.4''s count is attributable to the CPF path and not to ambient traffic or a body that audits everything');

select * from finish();
rollback;
