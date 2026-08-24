-- =========================================================================
-- 366 — FUP-0137-PHI-MODE-SHIMS: `get_case_detail` no longer emits the derived
--       `patient_enabled` key, and this file is what keeps it from coming back.
--
-- ⭐ WHY A KEYSTONE FOR A DELETED LINE. ADR 0137 D1 replaced a boolean PHI
--    switch with a three-mode setting, and the boolean survived the columns as a
--    DERIVED envelope key (`patient_mode <> 'none'`) so the build deployed at the
--    time kept working. Migration `20261003001800` removed it once the code was
--    deployed. Nothing else in the repo would notice if it returned: re-adding a
--    convenience boolean to a `jsonb_build_object` breaks no type, no test and no
--    gate — it just quietly reintroduces a value that CANNOT EXPRESS `required`,
--    which is the one mode the ADR was written to introduce. A shim that is lossy
--    in only the NEW direction is invisible by construction; that is the defect
--    class, and a keystone is the only thing that can contradict it.
--
-- ⚠ TWO LEVELS, DELIBERATELY, because either alone is weak:
--    §1 asks the CATALOG (`prosrc`) — cheap, and it is the level a re-add is
--       written at.
--    §2 asks the ENVELOPE the product actually receives. A `prosrc` assertion is
--       satisfied by a function that no longer runs at all; §2 is not.
--    §2's vacuity controls are the load-bearing half: `jsonb ? 'k'` is FALSE for
--       an empty envelope, a NULL-returning door and a refused call alike, so
--       "the key is absent" passes for three reasons that are not the one being
--       claimed. 2.2–2.5 pin that the envelope is populated and carries the REAL
--       fields, in BOTH modes a case can be constructed in.
-- =========================================================================

begin;
select plan(10);   -- 0.1 · 1.1 · 2.1-2.6 · 3.1-3.2

-- =========================================================================
-- (0) FLAG PRECONDITION — ASSERTED, NOT SET-AND-ASSUMED. A suite that only
-- SETS its flags can pass for the wrong reason, and a missing flag-enable
-- silently SKIPS the keystones it was written for.
-- =========================================================================
update app.feature_flags set enabled = true where key in ('case_patient', 'case_access');
select is(app.feature_enabled('case_patient'), true, '0.1 precondition: case_patient flag ON');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'comm_x')::uuid as comm_x from ctx;
grant select on k to authenticated;

-- Two cases, one per constructible mode. `required` is deliberately NOT built here:
-- it is enforced by `app.guard_case_patient_required` (a DEFERRABLE CONSTRAINT
-- TRIGGER on `cases`), so a bare INSERT in `required` mode with no patient would be
-- refused at COMMIT — the guard's own suite owns that, not this one.
create temp table cs on commit drop as
  select gen_random_uuid() as case_none, gen_random_uuid() as case_opt;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by, visibility_policy, patient_mode)
values ((select case_none from cs), (select comm_x from k), 9661, 'Caso sem PHI',
        (select sa_x from k), 'commission_default', 'none'),
       ((select case_opt from cs),  (select comm_x from k), 9662, 'Caso com PHI opcional',
        (select sa_x from k), 'commission_default', 'optional');

-- =========================================================================
-- §1 — THE CATALOG. `prosrc`, never the migration file: this body has been
-- re-emitted three times and the file text is stale by design (CLAUDE.md's
-- binding SQL exception).
-- ⚠ Counted, not `like`-tested: `case_patient_enabled` (the flag probe) CONTAINS
-- this substring, so a future body that calls it would make a `not like` check
-- red for a reason that is not a re-added key. Measured today: 0 occurrences.
-- =========================================================================
select is(
  (select (length(p.prosrc) - length(replace(p.prosrc, 'patient_enabled', '')))
          / length('patient_enabled')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_case_detail'),
  0,
  '1.1 get_case_detail''s body mentions patient_enabled ZERO times (the derived key is gone)');

-- =========================================================================
-- §2 — THE ENVELOPE. What the product receives, read as the case's coordinator.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select is(
  (public.get_case_detail((select case_opt from cs)) ? 'patient_enabled'),
  false,
  '2.1 KEYSTONE — the envelope carries NO patient_enabled key (optional-mode case)');

-- VACUITY CONTROLS. Without these, 2.1 passes on an empty envelope.
select is(
  (public.get_case_detail((select case_opt from cs)) ? 'patient_mode'),
  true,
  '2.2 control: the envelope IS populated and carries patient_mode — 2.1 is not passing on an empty jsonb');
select is(
  (public.get_case_detail((select case_opt from cs)) ? 'patient_required_fields'),
  true,
  '2.3 control: …and patient_required_fields, the other half of the replacement');
select is(
  (public.get_case_detail((select case_opt from cs)) ->> 'patient_mode'),
  'optional',
  '2.4 control: the mode is the case''s REAL value, not a default — a key present but wrong would pass 2.2');

-- The other mode. The retired key's value differed BY MODE, so a re-add is most
-- plausible on the `none` branch; asserting only one mode would miss it.
select is(
  (public.get_case_detail((select case_none from cs)) ? 'patient_enabled'),
  false,
  '2.5 KEYSTONE — no patient_enabled key on a none-mode case either');
select is(
  (public.get_case_detail((select case_none from cs)) ->> 'patient_mode'),
  'none',
  '2.6 control: …and that case really is in none mode, so 2.5 is about the mode it names');

-- =========================================================================
-- §3 — THE DOOR STILL WORKS. A body that lost the key by losing its whole
-- envelope would satisfy every assertion above.
-- =========================================================================
select isnt(
  (public.get_case_detail((select case_opt from cs)) ->> 'id'),
  null,
  '3.1 control: the door returns a real case envelope (id present), not a stub');
select is(
  (public.get_case_detail((select case_opt from cs)) ->> 'label'),
  'Caso com PHI opcional',
  '3.2 control: …and it is THIS case — the assertions above are about the fixture they name');

select test_helpers.reset_role_and_claims();

select * from finish();
rollback;
