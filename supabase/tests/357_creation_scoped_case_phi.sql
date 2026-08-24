-- ADR 0134 Amendment 2 option D — CREATION-SCOPED PATIENT-IDENTIFIER WRITE.
-- Migration 20261003000600_creation_scoped_case_phi.
--
-- A member holding the ADR-0061 `create_cases` capability may supply patient identifiers
-- AS PART OF CREATING A CASE. They may not read them, may not edit them afterwards, and
-- may not dispose of them. This is the platform's FIRST PHI WRITE PATH NOT HELD BY A
-- COORDINATOR, so every pin below carries what would make it vacuous.
--
-- ⛔ THE KEYSTONE THAT MAKES "CREATION-ONLY" TRUE RATHER THAN DECORATIVE is §4: the same
-- administrativo, ONE CALL LATER, is refused on both post-creation writers for the case
-- they just created. Without it, "creation-only" is a comment.
--
-- ⛔ NO PHI TRAVELS BACK (lead ruling on §A2.4 risk 2). The lead narrowed the ADR's "the
-- response echoes the identifiers just written" to a NON-PHI structural result: a body
-- carrying identifier values to a principal holding no `read_standard_phi` would be a PHI
-- READ PATH wearing a different name. §7 pins that structurally.
--
-- ⛔ OWNER CONTEXT COMES FROM `test_helpers.reset_role_and_claims()`, NEVER FROM A BARE
-- `reset role` (FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS). `reset role` restores the ROLE
-- only; `request.jwt.claims` is transaction-scoped and survives it, so `auth.uid()` keeps
-- returning the LAST PERSONA. Every predicate assertion in this file that runs between
-- persona blocks — 5.1, 8.2a, 9.3 — is evaluated in what the file calls owner context, and
-- a stale claims GUC would silently re-point some of them at a persona. The verb does both
-- halves in one call so they cannot drift apart; both halves are pinned by
-- `358_unchecked_writers_and_owner_context.sql` §G.
-- ⚠ The ONE surviving raw `set_config('request.jwt.claims', ...)` here is §8c's, which
-- SETS a hand-built platform_admin hat rather than clearing one. It is not an instance of
-- the pattern above and must stay.
--
-- ⚠ SCOPE OF THIS FILE: the SINGLE-CASE path. The bulk path's own pins live in
-- `189_bulk_create_cases.sql` §2b/§8b and were RED pending a PO ruling — ✅ RULED 2026-08-22 (ADR 0134 Amendment 7: bulk needs
--     `create_cases` ∧ `assign_case_phases`, `all_phases` refused at the gate) and BUILT; the
--     pins live in `189` §2b/§8b. This header said "currently RED" after they were green — bulk
-- composes `activate_phase` (needs `assign_case_phases`) and, on `all_phases`,
-- `assign_narrative` (coordinator-only, no capability arm), so widening bulk's own gate
-- was necessary and NOT sufficient. Nothing in this file depends on that ruling.

begin;
-- 43 → 48 (2026-08-22, migration 20261003000900): §8c gained 8c.3b + the 8c.7/8c.8
-- no-under-grant twin, and §8d is new (the catalog exactness pin + the one-gate witness).
select plan(48);

-- =========================================================================
-- (0) FLAG PRECONDITIONS — asserted, not claimed. `app.audit_write` returns SILENTLY
-- when `audit_trail` is off, so §6 could pass or fail for the wrong reason without 0.2.
-- =========================================================================
update app.feature_flags set enabled = true
  where key in ('administrativo', 'case_patient', 'audit_trail', 'processless_cases',
                'cases_multi_phase', 'case_access');
select is(app.feature_enabled('administrativo'), true, '0.1 precondition: administrativo ON');
select is(app.feature_enabled('audit_trail'),   true, '0.2 precondition: audit_trail ON (audit_write is a SILENT no-op when off)');
select is(app.feature_enabled('case_patient'),  true, '0.3 precondition: case_patient ON');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;
-- The bootstrap platform_admin, for the B1 (8c) fixture.
create temp table k2 on commit drop as select (v->>'admin')::uuid as admin_id from ctx;
grant select on k2 to authenticated;

-- st_x is the SUBJECT: a plain staff member appointed Administrativo with `create_cases`.
-- Direct INSERT — the appoint/grant DOORS are 205's subject; here the appointment is a
-- fixture and must not depend on them.
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values ((select comm_x from k), (select st_x from k), (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values ((select comm_x from k), (select st_x from k), 'create_cases', (select sa_x from k));

-- =========================================================================
-- (1) CATALOG — creation-scope is STRUCTURAL, so it is pinned structurally.
-- ⛔ These are the assertions that make "no other caller exists" falsifiable instead of
-- a sentence in a comment. A fifth caller, or a grant to `authenticated`, reds them.
-- =========================================================================
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\y_set_participant_patient_unchecked\y'
      and p.proname <> '_set_participant_patient_unchecked'),
  4, '1.1 ⭐ CALLER SET: exactly FOUR routines call the unchecked writer — the gated door plus the three creation RPCs. ⚠ Bulk IS one of them already: the migration re-pointed its step (d) writer; what is pending a PO ruling is bulk''s AUTHORITY GATE, which is a different thing. A fifth caller reds this');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname='_set_participant_patient_unchecked'
      and not p.prosecdef),
  1, '1.2 the helper is SECURITY INVOKER, matching the sole precedent app._grant_case_access_unchecked');
select is(
  (select has_function_privilege('authenticated', p.oid, 'EXECUTE') from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='app' and p.proname='_set_participant_patient_unchecked'),
  false, '1.3 ⛔ ACL: authenticated holds NO execute on the helper. A fresh function''s proacl is NULL = the PERMISSIVE default INCLUDING PUBLIC, so this pins that the revoke actually took');
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'insert\s+into\s+(public\.)?patient_participants'),
  1, '1.4 ⭐ THE STRUCTURAL PROPERTY the participant-id-NULL argument rests on: exactly ONE routine in the database can create a patient participant. Re-derived here so the migration header''s claim cannot go stale silently');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('create_case','create_case_from_template')),
  2, '1.5 ⛔ OVERLOAD COUNT: exactly one create_case and one create_case_from_template. CREATE OR REPLACE cannot add a parameter, so the migration DROPs and recreates — a signature mismatch would leave an overload and PostgREST would 300 on the ambiguity');

-- ⭐ 1.6/1.7 — THE SIGNATURE ITSELF, pinned next to its reason.
-- 1.5 catches an OVERLOAD (two candidates, PostgREST 300s). It CANNOT catch the other
-- DROP+CREATE hazard, which is real and cost a suite abort here: a caller that NAMES the
-- old arity. `100_dashboard.sql:439` asserted
-- `has_function_privilege('anon', 'public.create_case_from_template(uuid,text,uuid,text,uuid,jsonb)', …)`
-- — a signature STRING, which stopped resolving the moment the seventh argument landed,
-- and the suite ABORTED rather than failing an assertion. Swept by property afterwards:
-- exactly ONE such executable reference existed in the tree. These two pins make a future
-- signature change red HERE, beside the explanation, instead of somewhere distant.
select is(
  (select p.oid::regprocedure::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='create_case'),
  'create_case(uuid,text,boolean,uuid[],uuid,text,uuid,jsonb)',
  '1.6 create_case''s exact signature (p_patient is the eighth argument)');
select is(
  (select p.oid::regprocedure::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='create_case_from_template'),
  'create_case_from_template(uuid,text,uuid,text,uuid,jsonb,jsonb)',
  '1.7 create_case_from_template''s exact signature (p_patient is the seventh argument)');

-- =========================================================================
-- (2) POSITIVE — the administrativo creates a case WITH identifiers, single-case path.
-- ⛔ Vacuity: a `lives_ok` alone passes on a door that silently wrote nothing, so every
-- positive here is followed by a read-back of the actual row.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table c1 on commit drop as
  select (public.create_case(
            (select comm_x from k), 'Caso PHI Adm', true, '{}'::uuid[], null, null, null,
            jsonb_build_object('name','Paciente Criado','mrn','MRN-CRIADO','sex','female')
          )).id as case_id;
grant select on c1 to authenticated;
select test_helpers.reset_role_and_claims();

select isnt((select case_id from c1), null,
  '2.1 the administrativo created a PHI-collecting case in ONE call (no second round-trip to lose)');
select is(
  (select pi.mrn from public.patient_identifiers pi
    join public.case_participants cp on cp.participant_id = pi.participant_id
   where cp.case_id = (select case_id from c1) limit 1),
  'MRN-CRIADO', '2.2 …and the identifiers actually landed in patient_identifiers');
select is((select has_patient from public.cases where id = (select case_id from c1)), true,
  '2.3 …and the has_patient denorm was maintained through the helper''s own guard bracket');
select is(
  (select count(*)::int from public.patient_participants pp
    join public.case_participants cp on cp.participant_id = pp.participant_id
   where cp.case_id = (select case_id from c1)),
  1, '2.4 REGRESSION GUARD (cannot fail today — 1.4 is why): exactly one patient participant. Recorded as a guard against a future second writer, NOT counted as evidence about this path');

-- =========================================================================
-- (3) THE SHAPE CHECKS STILL BITE — they live BELOW the cut, so every door gets them.
-- Without this the split could have moved authority AND validation off the new path.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Sem nome nem prontuario', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('sex','male')) $$, (select comm_x from k)),
  '23514', 'informe ao menos o nome ou o prontuário do paciente',
  '3.1 the ADR-0038 name-or-MRN floor still fires on the creation path (message pinned — several paths raise 23514)');
select throws_ok(
  format($$ select public.create_case(%L, 'Caso sem PHI', false, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','X')) $$, (select comm_x from k)),
  '23514', 'este caso não coleta identificação do paciente',
  '3.2 patient_mode is still enforced: identifiers on a patient_mode=none case are refused');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (4) ⭐ K-CREATION-ONLY — THE KEYSTONE. One call later, the same person is refused.
-- ⛔ The MESSAGE is load-bearing, not decoration: set_participant_patient has several
-- paths raising 23514/42501, and the flag assert raises too. An errcode-only throws_ok
-- would pass on the wrong lock — the same conflation measured at 670 sites in this repo.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_patient(%L, 'Tentativa', 'MRN-X') $$, (select case_id from c1)),
  '42501', 'apenas a coordenação da comissão pode registrar dados do paciente',
  '4.1 ⭐ CREATION-ONLY: the compat door refuses them for the case they JUST created');
select throws_ok(
  format($$ select public.set_participant_patient(%L, null, 'Tentativa', 'MRN-X') $$, (select case_id from c1)),
  '42501', 'apenas a coordenação da comissão pode registrar dados do paciente',
  '4.2 ⭐ CREATION-ONLY: …and so does the real gated writer. The wrapper kept its gate; only the body moved');
select test_helpers.reset_role_and_claims();
select is(
  (select pi.mrn from public.patient_identifiers pi
    join public.case_participants cp on cp.participant_id = pi.participant_id
   where cp.case_id = (select case_id from c1) limit 1),
  'MRN-CRIADO', '4.3 …and nothing was overwritten by the refused attempts');

-- =========================================================================
-- (5) ⭐ RULE 12 — the writer cannot READ what they wrote. Run THROUGH THE DOORS.
-- ⛔ Never against the tables: patient_identifiers grants `authenticated` NOTHING and
-- carries ZERO policies, so a direct-DML denial passes with the feature, without it, and
-- even if a door leaked. 5.3 is the positive control that proves the fixture can reach
-- the success state at the same door where 5.2 is refused.
-- =========================================================================
select is(app.can_read_case_patient((select case_id from c1), (select st_x from k)), false,
  '5.1 the creator holds NO read_standard_phi — the creator self-grant passes read_standard_phi=false');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(public.get_case_patients((select case_id from c1)), null,
  '5.2 ⭐ THROUGH THE DOOR: get_case_patients returns NULL to the person who wrote the row');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select isnt(public.get_case_patients((select case_id from c1)), null,
  '5.3 ⭐ POSITIVE CONTROL, SAME DOOR, SAME CASE: the coordinator CAN read it — so 5.2 is a denial, not an empty fixture');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (6) AUDIT (Rule 11) — the write is attributable to the administrativo.
-- The audit fires on the TABLE (trg_audit_patient_identifiers), not the RPC, so it
-- survives any door. Payload is empty by design: attributable, not reconstructable.
-- =========================================================================
select cmp_ok(
  (select count(*)::int from public.audit_log
    where action = 'case_patient.updated' and entity_id = (select case_id from c1)
      and actor_id = (select st_x from k)),
  '>=', 1, '6.1 a case_patient.updated row is attributed to the ADMINISTRATIVO who wrote it');
-- ⚠ NOT `= '{}'` — measured: app.audit_write APPENDS {"acting_as": <role>} when
-- app.active_role() is non-null, so the trigger's '{}'::jsonb argument is not what lands.
-- An equality pin here would assert the wrong thing and red for a reason unrelated to
-- Rule 11. What Rule 11 actually requires is that no identifier value or key rides along.
select is(
  (select (metadata::text like '%MRN-CRIADO%'
        or metadata ? 'name' or metadata ? 'mrn' or metadata ? 'date_of_birth')
     from public.audit_log
    where action = 'case_patient.updated' and entity_id = (select case_id from c1)
      and actor_id = (select st_x from k) limit 1),
  false, '6.2 …and the payload carries NO identifier value and no identifier key (Rule 11: attributable, never reconstructable). Non-vacuous: 2.2 proves MRN-CRIADO really is in the database for this case, so it COULD have appeared here');

-- =========================================================================
-- (7) ⭐ NO PHI TRAVELS BACK (lead ruling narrowing §A2.4 risk 2).
-- The confirmation the user sees is built client-side from their own submission; the
-- server returns a structural result only. Pinned structurally, both directions.
-- =========================================================================
select is(
  (select count(*)::int from pg_attribute
    where attrelid='public.cases'::regclass and attnum>0 and not attisdropped
      and attname ~ '(name|mrn|birth|age|sex|encounter|unit|attending)'),
  0, '7.1 ⭐ public.cases carries NO identifier-shaped column, so no identifier value can travel back through the return type');
select is(
  (select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_case'),
  'cases', '7.2 …and create_case still RETURNS cases — the return type did not widen to carry a payload');
select is(
  (select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_case_from_template'),
  'cases', '7.3 …same for create_case_from_template');
-- ⚠ The ABSENCE half is the one that can be vacuous, so this fixture WROTE a value that
-- COULD have appeared: 2.2 proves 'MRN-CRIADO' is in the database for this very case.
select is(
  (select count(*)::int from public.patient_identifiers pi
    join public.case_participants cp on cp.participant_id = pi.participant_id
   where cp.case_id = (select case_id from c1) and pi.mrn = 'MRN-CRIADO'),
  1, '7.4 ⭐ NON-VACUITY: a real identifier value exists for this case, so 7.1-7.3 are asserting an absence that COULD have been present');

-- =========================================================================
-- (8) NEGATIVES — M8 covers all three through one predicate.
-- ⚠ 8.2 is STRUCTURAL: commission_admin_cap_appointment_fk is ON DELETE CASCADE, so
-- "appointment revoked ⇒ capability gone" tests an FK, not the widening.
-- =========================================================================
delete from public.commission_administrativo_capabilities
 where commission_id = (select comm_x from k) and user_id = (select st_x from k);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Negado', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','N')) $$, (select comm_x from k)),
  '42501', 'sem permissão',
  '8.1 capability revoked => creation (and therefore its PHI write) is refused at the door');
select test_helpers.reset_role_and_claims();
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values ((select comm_x from k), (select st_x from k), 'create_cases', (select sa_x from k));

create temp table mrow on commit drop as
  select * from public.memberships
   where commission_id = (select comm_x from k) and principal_id = (select st_x from k);
delete from public.memberships
 where commission_id = (select comm_x from k) and principal_id = (select st_x from k);
-- ⛔ RE-ANCHORED ON THE DOOR (QA B1 contributing cause). This asserted the PREDICATE
-- (`member_can_for(...) = false`) and therefore never had to reckon with the DOOR's full
-- disjunct set — which is how an extra `app.is_admin()` arm on `create_case` stayed
-- invisible to an otherwise thorough suite. A predicate quoted at the wrong grain reads
-- like a proof of the door. The predicate check is KEPT as the mechanism control, but the
-- load-bearing assertion is now the door raising.
select is(app.member_can_for((select comm_x from k), 'create_cases', (select st_x from k)), false,
  '8.2a MECHANISM: membership removed => the ORPHAN loses the capability predicate, though appointment + capability rows survive (no FK, no cascade)');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Orfao', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','N')) $$, (select comm_x from k)),
  '42501', 'sem permissão',
  '8.2b ⭐ AT THE DOOR: the ORPHAN is refused by create_case itself — the assertion that has to survive every disjunct the gate carries, not just the one under test');
select test_helpers.reset_role_and_claims();
insert into public.memberships select * from mrow;

-- =========================================================================
-- (8c) ⭐ THE NOUN RULE AT THIS DOOR — platform_admin CREATES NOTHING HERE.
--
-- ⚠ REWRITTEN 2026-08-22 BY PO RULING (FUP-CREATE-CASE-IS-ADMIN-DISJUNCT-VS-THE-NOUN-RULE;
-- migration 20261003000900). What this block used to pin was the QA-B1 HALF-MEASURE: the
-- platform-admin disjunct stayed on CREATION and only the PHI branch was gated down, so
-- 8c.1 expected a PHI-specific message and 8c.2 asserted that the SAME principal still
-- created cases. The PO removed the disjunct outright, so **8c.2 INVERTS**. That inversion
-- IS the ruling being delivered — it is not a regression being absorbed. CLAUDE.md §1's
-- noun rule (ADR 0078 A35) stands unamended: a case is commission CONTENT, and
-- platform_admin administers tenancy, identity, vocabulary and audit only.
--
-- ⛔ MESSAGE, NOT JUST ERRCODE. There used to be TWO gates here and BOTH raised 42501, so
-- an errcode-only assertion could never say which refused. There is now exactly ONE — and
-- that makes the message MORE load-bearing, not less: several other paths in this body
-- raise 42501/23514 (the flag asserts, the shape checks, the outcome/department guards),
-- so an errcode-only throws_ok would pass on the wrong lock. Every refusal below names the
-- KIND of refusal.
--
-- ⛔ NO-UNDER-GRANT TWIN (8c.5–8c.8). Removing an arm is exactly the change that can
-- over-narrow, and an under-grant EMITS NOTHING — no error, no log, no failing test. Both
-- surviving arms therefore create a case HERE, after the cut, in this same transaction:
-- the coordinator arm at 8c.5/8c.6 and the `member_can('create_cases')` arm at 8c.7/8c.8.
-- Each `lives_ok` is followed by a read-back — a door that silently wrote nothing passes a
-- bare `lives_ok`.
-- =========================================================================
do $$ begin perform set_config('request.jwt.claims',
  json_build_object('sub', (select admin_id from k2), 'role', 'authenticated',
                    'is_admin', true, 'active_role', 'platform_admin')::text, true); end $$;
select is(app.is_admin(), true,
  '8c.0 ⭐ PRE / ANTI-VACUITY: the fixture really IS a hatted platform_admin. app.is_admin() needs BOTH the entitlement AND active_role = platform_admin, so without this the refusals below could be a broken hat rather than the guard');
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Admin com PHI', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','Paciente Proibido','mrn','MRN-NAO')) $$, (select comm_x from k)),
  '42501', 'sem permissão',
  '8c.1 ⭐ a hatted platform_admin supplying p_patient is refused. ⚠ THE MESSAGE CHANGED with the ruling: it is now the AUTHORITY gate''s generic ''sem permissão'', because they no longer get past it — not 20261003000800''s PHI-specific message, whose gate was deleted once it became unreachable');
select throws_ok(
  format($$ select public.create_case(%L, 'Admin sem PHI', true, '{}'::uuid[], null, null, null, null) $$,
         (select comm_x from k)),
  '42501', 'sem permissão',
  '8c.2 ⭐⭐ THE RULING ITSELF (INVERTED 2026-08-22): the SAME principal at the SAME door is now refused WITHOUT any PHI payload too. platform_admin has lost case creation ENTIRELY — the noun rule was upheld rather than exempted at this door. This assertion previously read lives_ok');
select test_helpers.reset_role_and_claims();
select is((select count(*)::int from public.cases where label = 'Admin com PHI'), 0,
  '8c.3 ⛔ REFUSED AT THE GATE: the rejected call minted NO case. A silently dropped payload would be data loss wearing a success, and would rebuild the M10 half-state this increment removed');
select is((select count(*)::int from public.cases where label = 'Admin sem PHI'), 0,
  '8c.3b ⛔ …and so did the PHI-less call. Without this, 8c.2 could be satisfied by a door that raised AFTER minting the row — the refusal has to leave nothing behind, exactly as 8c.3 requires of the PHI one');
select is(
  (select count(*)::int from public.patient_identifiers where mrn = 'MRN-NAO'), 0,
  '8c.4 …and wrote no identifiers anywhere');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_case(%L, 'Coord com PHI', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','Paciente Permitido','mrn','MRN-SIM')) $$, (select comm_x from k)),
  '8c.5 ⭐ NO-UNDER-GRANT TWIN, ARM 1 OF 2 (is_staff_admin_of): the coordinator supplying p_patient SUCCEEDS at the same door in the same transaction — so 8c.1/8c.2 are a refusal of that principal class, not a door the cut broke for everyone');
select test_helpers.reset_role_and_claims();
select is((select count(*)::int from public.patient_identifiers where mrn = 'MRN-SIM'), 1,
  '8c.6 …and the coordinator''s identifiers actually landed');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_case(%L, 'Adm pos-corte', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','Paciente Delegado','mrn','MRN-TWIN')) $$, (select comm_x from k)),
  '8c.7 ⭐ NO-UNDER-GRANT TWIN, ARM 2 OF 2 (member_can(''create_cases'')): the Administrativo delegate ALSO still creates, WITH a PHI payload. This is the arm the deleted PHI gate existed to protect, so it is the one the collapse could have taken out silently — §2 proves it worked BEFORE the §8/§8b membership and capability churn, this proves it works AFTER, past the cut');
select test_helpers.reset_role_and_claims();
select is(
  (select count(*)::int from public.patient_identifiers where mrn = 'MRN-TWIN'), 1,
  '8c.8 …and the delegate''s identifiers actually landed — a bare lives_ok would pass on a door that wrote nothing');

-- =========================================================================
-- (8d) ⭐⭐ CATALOG — THE AUTHORITY GATE'S PREDICATE SET, PINNED AS TEXT.
--
-- ⛔ A COMMENT CANNOT CARRY THIS, which is why the pin exists. The migration's body says
-- "exactly two arms"; a comment is an assertion that goes stale silently, and this repo
-- has been bitten by that five times — one of them shipped a bug, and one of them is the
-- comment inside `bulk_create_cases` that claimed 314 §11.34 covered a predicate §11.34
-- never checked (corrected by the same migration).
--
-- ⛔ AND §8c ABOVE CANNOT CARRY IT EITHER. 8c pins today's BEHAVIOUR for three principals.
-- It is structurally blind to a FOURTH arm added tomorrow for a principal no fixture in
-- this file builds — which is EXACTLY how the platform-admin arm survived an otherwise
-- thorough suite until QA B1. A behavioural suite can only refuse the principals it
-- constructs; the catalog can refuse the ones nobody thought of.
--
-- ⚠ THE FAILURE MESSAGE CARRIES ITS OWN REASONING, deliberately: since 20261003000900
-- deleted the second (PHI-specific) gate — unreachable once its predicate equalled the
-- authority gate's — THIS EXPRESSION IS THE ONLY THING between a principal and the
-- creation-scoped patient-identifier write at the bottom of the body (ADR 0134 Amdt 2).
-- A red here must not read as a stale constant to bump.
-- =========================================================================
select is(
  (select (regexp_match(
     regexp_replace(
       regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g'),
       '\s+', ' ', 'g'),
     'if not \((.*?)\) then raise exception ''sem permissão'''))[1]
     from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f' and p.proname='create_case'),
  'app.is_staff_admin_of(p_commission_id) or app.member_can(p_commission_id, ''create_cases'')',
  '8d.1 ⭐⭐ EXACTNESS: create_case''s authority gate is EXACTLY {is_staff_admin_of, member_can(''create_cases'')} — no more arms, and no fewer. ⛔ IF THIS IS RED BECAUSE AN ARM WAS ADDED: widening this gate widens WHO MAY WRITE PHI AT CREATION (ADR 0134 Amdt 2 — nothing else gates that write since 20261003000900). Answer the PHI question first; do not just bump the string. ⛔ IF IT IS RED BECAUSE AN ARM WENT MISSING: that is an under-grant, which emits nothing at runtime — see the 8c.5/8c.7 twins');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f' and p.proname='create_case'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          like '%ou um Administrativo autorizado a criar casos pode registrar dados do paciente%'),
  0,
  '8d.2 ⭐ ONE GATE, NOT TWO: the second, PHI-specific gate 20261003000800 added is GONE, and its message string is the witness (measured: create_case was the ONLY routine in the database carrying that string). Its predicate had become identical to the authority gate''s the moment the platform-admin arm was cut, so it was dead code that would have SILENTLY COME BACK TO LIFE on a future widening — a bar the widener never knew they were inheriting');

-- =========================================================================
-- (9) FLAG-DARK — both switches, on the CREATION path specifically. The helper carries
-- its own `assert_case_patient_enabled`, and 9.2 is what makes that copy falsifiable:
-- with it removed, the creation path would write PHI while case_patient is dark.
-- =========================================================================
update app.feature_flags set enabled = false where key = 'administrativo';
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Escuro', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','N')) $$, (select comm_x from k)),
  '42501', 'sem permissão',
  '9.1 administrativo flag OFF => the kill switch darkens the creation door');
select test_helpers.reset_role_and_claims();
update app.feature_flags set enabled = true where key = 'administrativo';

update app.feature_flags set enabled = false where key = 'case_patient';
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'PHI escuro', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','N','mrn','M')) $$, (select comm_x from k)),
  '23514', null,
  '9.2 ⭐ case_patient flag OFF => the creation path refuses the PHI write. This is what makes the helper''s OWN flag assert falsifiable — wrapper-only, this pin would go green while PHI was written in the dark');
select test_helpers.reset_role_and_claims();
update app.feature_flags set enabled = true where key = 'case_patient';
select is(app.feature_enabled('case_patient'), true,
  '9.3 restore verified: case_patient is back ON (a hardcoded restore goes stale exactly like the value it replaces)');

-- =========================================================================
-- (10) THE COORDINATOR PATH IS UNCHANGED — the split moved a body, not a boundary.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_patient(%L, 'Editado pela coordenação', 'MRN-COORD') $$,
         (select case_id from c1)),
  '10.1 the coordinator still edits identifiers through the gated door after creation');
select test_helpers.reset_role_and_claims();
select is(
  (select pi.mrn from public.patient_identifiers pi
    join public.case_participants cp on cp.participant_id = pi.participant_id
   where cp.case_id = (select case_id from c1) limit 1),
  'MRN-COORD', '10.2 …and the edit landed — the wrapper delegates rather than merely returning');

select * from finish();
rollback;
