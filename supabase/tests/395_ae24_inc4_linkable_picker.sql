-- AE2.4 INCREMENT 4 — THE COORDINATOR PICKER: AN INVOKER WRAPPER OVER A DEFINER
-- AFFILIATION HELPER.  Ruling: ADR 0164 § Decision item 4 (shape C-b', option C-a
-- REJECTED).  Phase record: docs/progress/authz-ae2.md § AE2.4 increment 4.
--
-- ⛔ RE-CUT FOR THE `profiles.home_organization_id` DROP — A SMALL RE-CUT, BECAUSE
--    ONLY 8 OF THE 44 CELLS EVER TOUCHED THE COLUMN.  Deleted: the five `old_set`
--    perimeter-preservation cells (old § 1.1–§ 1.5), the `'6->2'` differential
--    anchor (old § 2.8) and the two column re-sweep cells (old § 7.1 / § 7.2).
--    ⭐ The other 36 are live coverage of the picker, the helper, the INVOKER
--    perimeter, the option-C-a gate, the sibling pin and the orphan wrapper, and
--    almost all of them are UNIQUE — this file is barely a differential suite and
--    never mostly was one.
--    ⚠ § 1.6 SURVIVES and is the reason § 1 still exists: the REJECTED naive shape,
--    measured in-transaction. It is column-free (`new_set` + `naive`) and it is the
--    only place in the tree where the collapse to one candidate is a RESULT rather
--    than a remembered sentence.
--
-- ============================================================================
-- ⛔⛔ WHY THE SECURITY CONTEXT OF THE WRAPPER IS THE SUBJECT OF THIS FILE
-- ============================================================================
-- `listLinkableOrgUsers` was a PLAIN RLS READ on `profiles`, filtered on the
-- person's home organisation.  Its docstring calls that "the coordinator's
-- OWN read perimeter, intersected with the org" — the perimeter comes from
-- `profiles_select_self_or_admin`'s CO-MEMBERSHIP arm, which is what lets a
-- `staff_admin` coordinator see the people they might seat on an ethics case.
--
-- ⛔ THE NAIVE RE-PREDICATION IS MEASURED AND REJECTED.  Pointing that read at
--    `organization_affiliations` collapses the coordinator's picker from TEN
--    candidates to ONE — themselves — because that table's SELECT policy is
--    `principal_id = auth.uid() OR app.is_org_admin_of(organization_id)`, with
--    NO staff_admin arm and NO hospital tier, BY DESIGN (ADR 0151 D1).  An
--    embedded `!inner` join collapses identically: the embed is RLS-filtered too.
--    § 1.6 measures that collapse in this transaction so the number is a RESULT
--    and not a remembered sentence.
--
-- ⛔ THE STAKES ARE GOVERNANCE, NOT UX.  A coordinator who cannot find the
--    respondent under *possui conta* is pushed to *não possui conta*, which
--    ADR 0108 D6 makes an AUDITED HUMAN ASSERTION rendering the case exclusion
--    VACUOUSLY SATISFIED.  The automatic impedimento silently stops working and
--    the record shows a deliberate assertion where there was a UI dead end.
--
-- ⛔ OPTION C-a IS REJECTED AND MUST NOT BE RE-PROPOSED (ADR 0164 § Consequences):
--    adding a staff_admin / co-membership arm to `organization_affiliations_select`
--    repairs an application read by WIDENING A TENANCY POLICY, against an ADR that
--    says "no hospital tier, by design".  A policy widened for a picker stays
--    widened for everything else it gates.  ⭐ § 0.7 is that prohibition expressed
--    as a GATE rather than as prose: it pins the policy count, its command and the
--    md5 of its normalised qual, so the widening reds here instead of shipping.
--
-- SHAPE C-b', the one built:  a `public` **INVOKER** RPC
-- (`public.list_linkable_org_users`) — so `profiles` RLS still applies to the
-- caller and the perimeter semantics are preserved EXACTLY — whose body filters
-- with a `bool`-returning `app` **DEFINER** helper
-- (`app.person_has_active_org_affiliation`) so the AFFILIATION lookup alone is
-- not RLS-bound.  It never materialises a roster.
--
-- ⚠ THE WRAPPER'S `prosecdef = f` IS LOAD-BEARING, NOT HYGIENE.  Flip it to
--   DEFINER and the picker stops being a perimeter intersection and becomes an
--   org-wide roster disclosure to anyone who can execute it.  § 0.1 pins the
--   flag; § 4.1 is the BEHAVIOURAL cell that reds when it flips (a cross-org
--   caller must get ZERO rows although the affiliation predicate is true for
--   ten people — § 4.2 is the floor that stops § 4.1 passing over an empty set).
--
-- ============================================================================
-- ⚠ A PRE-DECLARED WIDENING — STATED HERE BECAUSE IT IS INHERENT TO C-b'
-- ============================================================================
-- An INVOKER wrapper can only call functions the CALLER may execute, so the
-- DEFINER helper must be granted to `authenticated`.  That makes it a one-bit
-- existence oracle: any authenticated caller who already knows a (person, org)
-- uuid pair can ask whether that person is actively affiliated there.
--
-- Bounded, and the bound is asserted rather than argued:
--   · it discloses ONE BIT about a pair of opaque uuids — it is not enumerable;
--   · for any person the caller can ALREADY see, it discloses nothing the picker
--     does not (inclusion/exclusion says the same thing);
--   · it does NOT become a roster — § 4.1 / § 5.2.
-- § 5.1 asserts the disclosure POSITIVELY, so it is a recorded decision rather
-- than an accident a later reader has to rediscover.
--
-- ⛔ The alternative that removes the oracle — a DEFINER wrapper re-imposing the
--    `profiles` perimeter in its own body — was rejected: it duplicates a
--    six-arm RLS policy inside a function, and the second copy is what drifts.
--
-- ============================================================================
-- THE SHIPPED CONTRACT, REPRODUCED FROM THE CATALOG
-- ============================================================================
--   supabase.rpc('list_linkable_org_users', { p_organization: org })
--     → public.list_linkable_org_users(uuid)
--         returns table(user_id uuid, full_name text, email text)
--       where p.is_active and not p.is_admin
--         and app.person_has_active_org_affiliation(p.id, p_organization)
--       order by p.full_name asc nulls last, p.id
--       limit 500
--
--   ⚠ The shape it replaced — a client-side `profiles` read filtered on the person's
--     home organisation, `is_active`, `is_admin`, ordered by `full_name`, limited to
--     500 — is recorded here as HISTORY. Its two surviving conjuncts are pinned as
--     live properties by § 2.6 (`is_active`) and § 2.7 (`is_admin`), its order by
--     § 6.1 and its cap by § 6.2; the org conjunct is now the affiliation helper's,
--     pinned by § 2.4 and § 3.4.
--
-- ⚠ ACTIVE, not NON-VOIDED — and the divergence from ADR 0163's retention is
--   deliberate, with AE2.2's own reason of record.  This door answers *"who may
--   be SEATED here"*, the same question as `list_addable_commission_members`;
--   `app.person_authority_orgs` answers *"who may be ADMINISTERED"*.  ADR 0163's
--   last-org retention answers the second only and was never an input to the
--   first, so active-only here is not a RESTRICTION of retention — retention is
--   out of scope.  § 2.2 is the cell that would flip if the two were ever unified.
--
-- ⚠ ORDERING GAINED A TIE-BREAK.  The shipped read ordered by `full_name` alone,
--   which is non-deterministic among equal names; the RPC appends `, p.id`.  A
--   deliberate, stated narrowing of the output's freedom, not a behaviour change
--   any caller can observe (every caller filters client-side and none reads an
--   index).
--
-- ============================================================================
-- WHAT THE SEED CANNOT REACH, AND WHAT WAS BUILT INSTEAD
-- ============================================================================
-- ⛔ EVERY SEEDED PERSON IS ACTIVELY AFFILIATED TO EXACTLY THE ORGANISATION THEY
--    WORK IN, so the seed cannot construct any of the interesting states: an ended
--    affiliation, a voided-only one, an orphan, or a person whose only affiliation
--    is in another organisation.  § 2 constructs all eight.
-- ⚠ § 1 USED TO CARRY FIVE PERIMETER-PRESERVATION CELLS, one per caller class —
--    `old_set = new_set` for a staff_admin, a staff, a two-commission member, a
--    hospital_admin and an org_admin.  All five were `old_set`, built from the
--    dropped column, and all five are deleted.  ⛔ THAT IS A REAL COVERAGE LOSS AND
--    IT IS NAMED HERE RATHER THAN PAPERED OVER: the picker's population is now
--    ASSERTED for `chefe.ccih` alone (§ 1.6, § 1.7).  The loop still MEASURES all
--    five callers — the fixture is intact and the rows are there — but four of them
--    carry no verdict.  Restoring them means a floor per caller class written
--    against a live database, which is a new assertion someone must specify and
--    verify, not something this re-cut could invent.
--
-- ⭐ THE ISOLATION § 2 HAD TO BUY.  The picker is an INTERSECTION of two gates:
--    the caller's `profiles` perimeter AND the affiliation predicate.  A target
--    absent from the picker is absent for one of two reasons, and the two are
--    indistinguishable.  Every constructed target therefore holds a CCIH
--    commission membership, which puts it inside `chefe.ccih`'s co-membership
--    arm unconditionally; § 2.0 MEASURES that (all eight visible) so every § 2
--    absence is attributable to the affiliation predicate and to nothing else.
--    ⛔ That membership is not a fixture convenience — it is the realistic case:
--    the people most likely to be seated on an ethics case ARE the commission's
--    own members, which is why this door is not `listAddableMembers`.
--
-- ⛔ THE FIXTURE DOES NOT BUILD ITS WORLD OUT OF THE SUBJECT UNDER TEST.  Every
--    target's org affiliation is inserted DIRECTLY, never through
--    `affiliate_person_to_org_for` (whose own tenant gate is increment 1's
--    subject and would silently refuse exactly the divergent shapes § 2 needs).
--    Ids live in a `0ae24d…` namespace disjoint from 390/391/392/393/394 and every
--    deletion is by identity.
-- ============================================================================

begin;
select plan(36);

-- Constants, resolved once so no assertion re-derives them differently.
create function pg_temp.k4()
returns table (org_a uuid, org_b uuid, org_c uuid, ccih uuid,
               chefe uuid, john uuid, multi uuid, hospadm uuid,
               oadm_a uuid, oadm_b uuid, solo_c uuid)
language sql stable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,
         '0c000000-0000-0000-0000-00000000000b'::uuid,
         '0c000000-0000-0000-0000-00000000000c'::uuid,
         'a0000000-0000-0000-0000-0000000000a1'::uuid,
         '00000000-0000-0000-0000-000000000002'::uuid,   -- chefe.ccih   staff_admin CCIH
         '00000000-0000-0000-0000-0000000000a1'::uuid,   -- dr.john      staff (Ética)
         '00000000-0000-0000-0000-000000000008'::uuid,   -- multi        staff x2
         '00000000-0000-0000-0000-0000000000e1'::uuid,   -- hospitaladmin.a1
         '00000000-0000-0000-0000-0000000000b1'::uuid,   -- orgadmin.a
         '00000000-0000-0000-0000-0000000000b2'::uuid,   -- orgadmin.b
         '00000000-0000-0000-0000-0000000000c0'::uuid;   -- solo.c (org C)
$$;
grant execute on function pg_temp.k4() to authenticated;

-- ============================================================================
-- § 0 STRUCTURAL PINS — asserted before any fixture exists, so a fixture that
--     fails to build cannot make them pass by accident.
-- ============================================================================

select is(
  (select p.prosecdef::text || '|' || l.lanname || '|' || p.prokind::text
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_language  l on l.oid = p.prolang
    where n.nspname = 'public' and p.proname = 'list_linkable_org_users'),
  'false|plpgsql|f',
  '0.1 ⭐⭐ THE WRAPPER IS SECURITY INVOKER — the flag that makes it a PERIMETER INTERSECTION rather than an org-wide roster disclosure. plpgsql is deliberate too (§ 0.2)');

select is(
  (select count(*)::text
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_language  l on l.oid = p.prolang
    where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'
      and l.lanname = 'plpgsql'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and p.proname = 'list_linkable_org_users'),
  '1',
  '0.2 the wrapper is INSIDE ARM=wrapper''s and census clause 2''s domain — the harness''s own domain predicate, evaluated here so a later edit that moves it OUT (language sql, a REVOKE) reds instead of silently leaving the enumeration');

select is(
  (select has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '|' ||
          has_function_privilege('anon', p.oid, 'EXECUTE')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_linkable_org_users'),
  'true|false',
  '0.3 wrapper ACL asserted POSITIVELY via has_function_privilege — never by reading proacl for absence (a NULL proacl includes PUBLIC)');

select is(
  (select p.prosecdef::text || '|' || p.provolatile::text || '|' ||
          (exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search\_path=%'))::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'person_has_active_org_affiliation'),
  'true|s|true',
  '0.4 the helper is DEFINER + STABLE + search_path-pinned — DEFINER is what takes the affiliation lookup out of the caller''s RLS, which is the entire mechanism');

select is(
  (select has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '|' ||
          has_function_privilege('anon', p.oid, 'EXECUTE')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'person_has_active_org_affiliation'),
  'true|false',
  '0.5 helper ACL: `authenticated` MUST hold EXECUTE — an INVOKER wrapper can only call what its caller can call, which is exactly what makes the § 5.1 oracle inherent rather than incidental');

select is(
  (select count(*)::text
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_type      t on t.oid = p.prorettype
    where n.nspname in ('app','public') and p.prosecdef
      and p.proname = 'person_has_active_org_affiliation'
      and t.typname = 'bool'
      and p.proname not in ('enqueue_notification','remind_document_approver')
      and ( (p.proname ~ '^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)'
             and p.proname !~ '^is_valid_')
            or regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
                 ~ 'auth\.uid\(\)|memberships|member_can|app\.is_|app\.can_|app\.has_|principal_id' )),
  '1',
  '0.6 the helper is INSIDE ARM=policy''s PRED_DOMAIN — reproduced from p0-authz-door-audit.sh verbatim. Its NAME does not match the door filter; it is admitted by `principal_id` in its body, and this assertion is what notices if a rewrite drops that word and silently leaves the swept domain');

select is(
  (select count(*)::text || '|' || max(cmd) || '|' || md5(max(regexp_replace(qual, '\s+', ' ', 'g')))
     from pg_policies where schemaname = 'public' and tablename = 'organization_affiliations'),
  '1|SELECT|9b622d17779c5f06b2b51a641225f6be',
  '0.7 ⭐⭐ OPTION C-a EXPRESSED AS A GATE: `organization_affiliations` still carries exactly ONE policy, SELECT, byte-identical. Widening a tenancy policy to repair an application read reds HERE rather than shipping (ADR 0164 § Consequences)');

select is(
  (select string_agg(nm, ',' order by ord)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join lateral unnest(p.proargnames, p.proargmodes::text[]) with ordinality as u(nm, md, ord)
    where n.nspname = 'public' and p.proname = 'list_linkable_org_users' and u.md = 't'),
  'user_id,full_name,email',
  '0.8 the wrapper returns EXACTLY the three fields `AddableUser` carries — not `setof profiles`, which under INVOKER cannot even run (`authenticated` holds no column grant on cpf / date_of_birth / phone) and under DEFINER would disclose all three');

-- ============================================================================
-- § 1 THE PICKER ON THE SEED POPULATION, AND THE SHAPE THAT WAS REJECTED.
--
-- ⛔ THE FIVE PERIMETER-PRESERVATION CELLS ARE DELETED WITH THE COLUMN.  Each was
--   `old_set = new_set` for one caller class, and `old_set` was a `profiles` read
--   filtered on `home_organization_id`.  There is no old set.
--
-- ⭐ THE LOOP IS KEPT AT FIVE CALLERS ON PURPOSE, and what it now measures is
--   stated plainly: only `chefe.ccih` carries a verdict (§ 1.6, § 1.7).  The other
--   four rows are MEASURED AND UNASSERTED — kept because they are the fixture the
--   restored floors would need and because deleting them would delete the only
--   place `dr.john`, `multi` and `hospitaladmin.a1` appear in this file, not
--   because four unasserted rows are coverage.  ⛔ Do not read this loop as five
--   callers being checked.
--
-- ⚠ § 1.6 is why § 1 still exists: the naive re-predication, evaluated on the SAME
--   caller in the SAME transaction, collapses the coordinator's picker to ONE
--   candidate.  § 2 carries the constructed states.
-- ============================================================================

create temp table seed_perim (caller text, new_set uuid[], naive int);
grant all on seed_perim to authenticated;

do $$
declare r record; v_new uuid[]; v_naive int; v_org uuid;
begin
  select org_a into v_org from pg_temp.k4();
  for r in select * from (values
      ('chefe.ccih'::text,      (select chefe   from pg_temp.k4()), 'staff_admin'::text),
      ('dr.john',               (select john    from pg_temp.k4()), 'staff'),
      ('multi',                 (select multi   from pg_temp.k4()), 'staff'),
      ('hospitaladmin.a1',      (select hospadm from pg_temp.k4()), 'hospital_admin'),
      ('orgadmin.a',            (select oadm_a  from pg_temp.k4()), 'org_admin')
    ) t(label, uid, arole)
  loop
    perform test_helpers.claims_for(r.uid, false, r.arole);
    set local role authenticated;

    select array_agg(u.user_id order by u.user_id) into v_new
      from public.list_linkable_org_users(v_org) u;

    select count(*) into v_naive
      from public.profiles p
     where p.is_active and not p.is_admin
       and exists (select 1 from public.organization_affiliations oa
                    where oa.principal_id = p.id and oa.organization_id = v_org
                      and oa.ended_on is null and oa.voided_at is null);

    perform test_helpers.reset_role_and_claims();
    insert into seed_perim values (r.label, coalesce(v_new,'{}'), v_naive);
  end loop;
end $$;

select is(
  (select (new_set is not null and array_length(new_set,1) > naive)::text || '|' || naive::text
     from seed_perim where caller = 'chefe.ccih'),
  'true|1',
  '1.6 ⭐⭐ THE REJECTED SHAPE, MEASURED IN THIS TRANSACTION: re-pointing the read at `organization_affiliations` under the caller''s own RLS leaves the coordinator ONE candidate — themselves — because that table''s SELECT policy has no staff_admin arm and no hospital tier, BY DESIGN (ADR 0151 D1). The shipped door returns strictly more on the same caller in the same transaction. ⛔ This is the whole reason shape C-b'' exists, and it is a RESULT here rather than a sentence someone remembered');

select cmp_ok((select array_length(new_set,1) from seed_perim where caller = 'chefe.ccih'), '>=', 5,
  '1.7 NON-VACUITY FLOOR — the coordinator''s picker is genuinely populated, so § 1.6''s `>` is not an empty set beating a smaller one, and § 2''s absences are absences from a real listing');

-- ============================================================================
-- § 2 THE CONSTRUCTED STATES — the eight affiliation shapes the seed cannot reach,
--     each measured THROUGH the wrapper (§ 3 measures the helper alone).
-- ============================================================================

create temp table d_targets (label text primary key, target uuid, note text);
grant all on d_targets to authenticated;
insert into d_targets values
  ('D1', '00000000-0000-0000-0000-0ae24d000001', 'ACTIVE affiliation in A'),
  ('D2', '00000000-0000-0000-0000-0ae24d000002', 'ENDED (non-voided) in A — the retention divergence'),
  ('D3', '00000000-0000-0000-0000-0ae24d000003', 'VOIDED-only in A — bound 1, void is not end'),
  ('D4', '00000000-0000-0000-0000-0ae24d000004', 'ACTIVE only in B — the org conjunct'),
  ('D5', '00000000-0000-0000-0000-0ae24d000005', 'no affiliation row at all — the orphan'),
  ('D6', '00000000-0000-0000-0000-0ae24d000006', 'ACTIVE in A but is_active = false'),
  ('D7', '00000000-0000-0000-0000-0ae24d000007', 'ACTIVE in A but is_admin = true — the noun rule'),
  ('D8', '00000000-0000-0000-0000-0ae24d000008', 'ACTIVE in BOTH A and B');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid, t.target, 'authenticated', 'authenticated',
       t.target::text || '@ae24d.test', now(), now()
from d_targets t;

-- ⛔ ALL EIGHT USED TO CARRY `home_organization_id = ORG A`, the divergent ones
--   included, which is what made old § 2.8's `6->2` attributable to the affiliation
--   predicate alone.  That write is gone with the column; `full_name` and
--   `is_active` were set by the same statement and are KEPT (D6 flips `is_active`
--   below, and § 2.6 is the cell that pins it).  Isolation for § 2's absences now
--   comes entirely from the CCIH membership below, which § 2.0 MEASURES.
update public.profiles
   set full_name = 'AE24d ' || (select label from d_targets d where d.target = profiles.id),
       is_active = true
 where id in (select target from d_targets);

update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0ae24d000006';
update public.profiles set is_admin  = true  where id = '00000000-0000-0000-0000-0ae24d000007';

-- The isolation buy: a CCIH membership puts every target inside `chefe.ccih`'s
-- co-membership arm, so § 2's absences are the affiliation predicate's alone.
insert into public.memberships (principal_id, organization_id, hospital_id, commission_id, role)
select t.target, null, null, (select ccih from pg_temp.k4()), 'staff' from d_targets t;

insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason, created_by)
values
  ('00000000-0000-0000-0000-0ae24d000001', (select org_a from pg_temp.k4()), date '2025-01-01', null, null, null, null, null, (select oadm_a from pg_temp.k4())),
  ('00000000-0000-0000-0000-0ae24d000002', (select org_a from pg_temp.k4()), date '2025-01-01', date '2026-01-10', (select oadm_a from pg_temp.k4()), null, null, null, (select oadm_a from pg_temp.k4())),
  ('00000000-0000-0000-0000-0ae24d000003', (select org_a from pg_temp.k4()), date '2025-01-01', null, null, now(), (select oadm_a from pg_temp.k4()), 'lançamento equivocado', (select oadm_a from pg_temp.k4())),
  ('00000000-0000-0000-0000-0ae24d000004', (select org_b from pg_temp.k4()), date '2025-01-01', null, null, null, null, null, (select oadm_b from pg_temp.k4())),
  -- D5 deliberately gets no row at all.
  ('00000000-0000-0000-0000-0ae24d000006', (select org_a from pg_temp.k4()), date '2025-01-01', null, null, null, null, null, (select oadm_a from pg_temp.k4())),
  ('00000000-0000-0000-0000-0ae24d000007', (select org_a from pg_temp.k4()), date '2025-01-01', null, null, null, null, null, (select oadm_a from pg_temp.k4())),
  ('00000000-0000-0000-0000-0ae24d000008', (select org_a from pg_temp.k4()), date '2025-01-01', null, null, null, null, null, (select oadm_a from pg_temp.k4())),
  ('00000000-0000-0000-0000-0ae24d000008', (select org_b from pg_temp.k4()), date '2025-01-01', null, null, null, null, null, (select oadm_b from pg_temp.k4()));

-- ⛔ `old_pred` — the column-based predicate, evaluated per (caller, target) — is
--   dropped with the column, together with its only consumer (old § 2.8).
create temp table d_seen (caller text, target uuid, in_picker boolean, visible boolean);
grant all on d_seen to authenticated;

do $$
declare r record; v_org uuid;
begin
  for r in select * from (values
      ('chefe.ccih'::text, (select chefe  from pg_temp.k4()), 'staff_admin'::text, (select org_a from pg_temp.k4())),
      ('orgadmin.b',       (select oadm_b from pg_temp.k4()), 'org_admin',         (select org_b from pg_temp.k4()))
    ) t(label, uid, arole, org)
  loop
    perform test_helpers.claims_for(r.uid, false, r.arole);
    set local role authenticated;
    insert into d_seen
    select r.label, d.target,
           exists (select 1 from public.list_linkable_org_users(r.org) u where u.user_id = d.target),
           exists (select 1 from public.profiles p where p.id = d.target)
      from d_targets d;
    perform test_helpers.reset_role_and_claims();
  end loop;
end $$;

select is((select count(*) filter (where visible)::text from d_seen where caller = 'chefe.ccih'), '8',
  '2.0 ⭐ THE ISOLATION BUY, MEASURED: `chefe.ccih` can read all EIGHT constructed profiles through the co-membership arm — so every absence below is attributable to the affiliation predicate and not to RLS. Without this cell each § 2 deny has two possible causes and proves neither');

select is((select in_picker from d_seen where caller='chefe.ccih' and target='00000000-0000-0000-0000-0ae24d000001')::text, 'true',
  '2.1 D1 ACTIVE in A — the accept cell. A predicate that denied everything would pass § 2.2-§ 2.7 by construction');
select is((select in_picker from d_seen where caller='chefe.ccih' and target='00000000-0000-0000-0000-0ae24d000002')::text, 'false',
  '2.2 D2 ENDED (non-voided) in A is OUT — the deliberate divergence from ADR 0163''s retention. This door answers "who may be SEATED", not "who may be ADMINISTERED"; unify the two and this cell flips');
select is((select in_picker from d_seen where caller='chefe.ccih' and target='00000000-0000-0000-0000-0ae24d000003')::text, 'false',
  '2.3 D3 VOIDED-only is OUT — bound 1, a void says the employment never should have existed. Separated from § 2.2 so the two conjuncts of the tense predicate are pinned independently');
select is((select in_picker from d_seen where caller='chefe.ccih' and target='00000000-0000-0000-0000-0ae24d000004')::text, 'false',
  '2.4 D4 ACTIVE only in ORG B is OUT of ORG A''s picker — the `organization_id` conjunct, measured THROUGH the wrapper and the caller''s RLS rather than on the helper alone (§ 3.4 is the helper''s own arm). ⭐ § 2.9 is its other half: the SAME person IS in org B''s picker, so this is discrimination and not a person who is simply invisible');
select is((select in_picker from d_seen where caller='chefe.ccih' and target='00000000-0000-0000-0000-0ae24d000005')::text, 'false',
  '2.5 D5 the ORPHAN (no affiliation row at all) is OUT — an accepted narrowing, recorded rather than discovered: the state is constructed, and ADR 0164 accepted the window it comes from');
select is((select in_picker from d_seen where caller='chefe.ccih' and target='00000000-0000-0000-0000-0ae24d000006')::text, 'false',
  '2.6 D6 the pre-existing `is_active` filter SURVIVES the re-predication — a conjunct silently dropped during a rewrite is how a picker starts offering deactivated accounts');
select is((select in_picker from d_seen where caller='chefe.ccih' and target='00000000-0000-0000-0000-0ae24d000007')::text, 'false',
  '2.7 D7 the NOUN RULE survives: a platform_admin is not a tenant person and never belongs on a tenant roster (ADR 0078 A35)');

-- ⛔ § 2.8 — `'6->2'`, the count under the OLD column predicate against the count
--   under the new one — IS DELETED WITH THE COLUMN.  It was the file's one true
--   differential anchor.  ⚠ WHAT IT CARRIED THAT THE PER-TARGET CELLS DO NOT: an
--   AGGREGATE over all eight, so a target silently dropped from `d_targets` would
--   move the number even if no § 2.x cell noticed.  That property is genuinely lost
--   — § 2.0's `'8'` is the nearest survivor and it counts VISIBILITY, not
--   membership of the picker.  Named rather than glossed.

select is((select in_picker from d_seen where caller='orgadmin.b' and target='00000000-0000-0000-0000-0ae24d000004')::text, 'true',
  '2.9 ⭐ D4 IS in ORG B''s picker — the organisation their only active affiliation names. Measured through a different caller and a different organisation, so § 2.4''s absence is the org conjunct discriminating and not an artefact of the A-side arithmetic');
select is((select in_picker from d_seen where caller='orgadmin.b' and target='00000000-0000-0000-0000-0ae24d000008')::text, 'true',
  '2.10 D8, active in BOTH orgs, appears in BOTH pickers — the arm that stops § 2.9 being satisfiable by a predicate that simply moved everyone to B');

-- ============================================================================
-- § 3 THE HELPER, BOTH POLARITIES, ONE CONJUNCT AT A TIME.
--     ⛔ A "never denies" mutation cannot move an accept cell, and a "never
--        accepts" mutation cannot move a deny cell.  § 3.1 is the accept side;
--        § 3.2-§ 3.5 are four denies that differ in exactly one column each.
-- ============================================================================

select is(app.person_has_active_org_affiliation('00000000-0000-0000-0000-0ae24d000001', (select org_a from pg_temp.k4()))::text,
  'true',  '3.1 ACTIVE in the asked-for org — the accept side of the helper');
select is(app.person_has_active_org_affiliation('00000000-0000-0000-0000-0ae24d000002', (select org_a from pg_temp.k4()))::text,
  'false', '3.2 ENDED, non-voided — the `ended_on is null` conjunct alone');
select is(app.person_has_active_org_affiliation('00000000-0000-0000-0000-0ae24d000003', (select org_a from pg_temp.k4()))::text,
  'false', '3.3 VOIDED, never ended — the `voided_at is null` conjunct alone. Its row has `ended_on IS NULL`, so a helper filtering only on tense would return TRUE here');
select is(app.person_has_active_org_affiliation('00000000-0000-0000-0000-0ae24d000001', (select org_b from pg_temp.k4()))::text,
  'false', '3.4 right person, WRONG ORG — the `organization_id` conjunct alone');
select is(app.person_has_active_org_affiliation('00000000-0000-0000-0000-0ae24dffffff', (select org_a from pg_temp.k4()))::text,
  'false', '3.5 ⭐ THE COMPOSITION TRAP''S QUESTION, ASKED: an unknown person id returns FALSE, not the permissive answer. A not-found path that answered TRUE would open the picker to every uuid');

-- ============================================================================
-- § 4 THE WRAPPER DOES NOT BYPASS RLS — the behavioural half of § 0.1.
-- ============================================================================

create temp table crossorg (n_rows int, n_free int);
grant all on crossorg to authenticated;

do $$
declare v_rows int; v_free int; v_org uuid;
begin
  select org_a into v_org from pg_temp.k4();
  select count(*) into v_free from public.profiles p
   where p.is_active and not p.is_admin
     and app.person_has_active_org_affiliation(p.id, v_org);

  perform test_helpers.claims_for((select solo_c from pg_temp.k4()), false, 'org_admin');
  set local role authenticated;
  select count(*) into v_rows from public.list_linkable_org_users(v_org);
  perform test_helpers.reset_role_and_claims();

  insert into crossorg values (v_rows, v_free);
end $$;

select is((select n_rows from crossorg)::text, '0',
  '4.1 ⭐⭐ A CROSS-ORG CALLER GETS ZERO ROWS. `solo.c` administers org C and can read no org-A profile; the affiliation predicate is true for many of them and the wrapper still returns nothing, because RLS is what decides the audience. THIS is the cell that reds when the wrapper is flipped to SECURITY DEFINER');
select cmp_ok((select n_free from crossorg), '>=', 10,
  '4.2 the floor that stops § 4.1 passing over an empty set: evaluated RLS-free, the same predicate admits at least ten people');

-- ============================================================================
-- § 5 THE PRE-DECLARED ORACLE — asserted POSITIVELY, so the disclosure is a
--     recorded decision rather than something a later reader has to rediscover.
-- ============================================================================

create temp table oracle (bit boolean, aff_rows int);
grant all on oracle to authenticated;

do $$
declare v_bit boolean; v_aff int;
begin
  perform test_helpers.claims_for((select solo_c from pg_temp.k4()), false, 'org_admin');
  set local role authenticated;
  select app.person_has_active_org_affiliation('00000000-0000-0000-0000-0ae24d000001',
                                               (select org_a from pg_temp.k4())) into v_bit;
  select count(*) into v_aff from public.organization_affiliations oa
   where oa.organization_id = (select org_a from pg_temp.k4());
  perform test_helpers.reset_role_and_claims();
  insert into oracle values (v_bit, v_aff);
end $$;

select is((select bit from oracle)::text, 'true',
  '5.1 ⚠ THE DECLARED WIDENING: a cross-org caller who cannot see D1 at all CAN ask the helper about them and gets TRUE. Inherent to C-b'' — an INVOKER wrapper may only call what its caller may call — and asserted here so it is a decision on the record, not an accident');
select is((select aff_rows from oracle)::text, '0',
  '5.2 and the oracle does NOT become a roster: the same caller still reads ZERO `organization_affiliations` rows for org A. One bit about a pair you already know is not the enumeration option C-a would have granted');

-- ============================================================================
-- § 6 SHAPE — the two properties no caller can observe but every caller depends on.
-- ============================================================================

create temp table ordered (sorted boolean);
grant all on ordered to authenticated;

do $$
declare v_ok boolean;
begin
  perform test_helpers.claims_for((select chefe from pg_temp.k4()), false, 'staff_admin');
  set local role authenticated;
  select bool_and(prev is null or prev <= full_name) into v_ok
    from (select full_name, lag(full_name) over (order by rn) as prev
            from (select full_name, row_number() over () as rn
                    from public.list_linkable_org_users((select org_a from pg_temp.k4()))) s) t;
  perform test_helpers.reset_role_and_claims();
  insert into ordered values (coalesce(v_ok, true));
end $$;

select is((select sorted from ordered)::text, 'true',
  '6.1 rows arrive ordered by `full_name` ascending — the shipped read''s display order, preserved inside the door so there is ONE place it lives');

select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'limit\s+500\y'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_linkable_org_users'),
  '6.2 the 500-row cap survives the move. ⚠ A TEXT pin, deliberately: no fixture this repo can build reaches 500 rows, so the alternative is not a better assertion but NO assertion — and a silently dropped cap on a picker is unbounded disclosure work per page load. ⛔ THE `\y` IS THE WHOLE ASSERTION AND THE MUTATION RUN IS WHY IT IS THERE: without the word boundary this pin matched `limit 5000` too, so mutation M12 passed GREEN while the cap had been widened tenfold — a substring match wearing the label of a bound');

-- ============================================================================
-- ⛔ § 7 — THE COLUMN RE-SWEEP — IS DELETED IN FULL.  It was "a floor handed to the
--    drop increment", and the drop increment has now happened.
--
--    § 7.1 asserted ZERO RLS policies reference `home_organization_id`. After the
--    drop that is not merely true, it is STRUCTURALLY UNFALSIFIABLE: policies are
--    dependency-tracked, so a `drop column` either fails or takes the policy with
--    it. A cell that cannot fail is not a gate.
--
--    § 7.2 pinned the remaining function set as a LIST — `guard_profile_privileged
--    _columns` and `handle_new_user`. ⚠ IT CARRIED THE SAME DOMAIN BUG AS `394
--    § 1.5`: scoped `nspname in ('app','public')`, it could never see
--    `test_helpers.bootstrap`, the THIRD body that named the column and the one
--    every suite in this tree runs through `00_setup.sql`. Rather than invert it
--    here AND in `394`, the inversion lives in `394 § 1.5` ALONE, over the whole
--    catalog and anchored to a `pg_attribute` check that the column is really gone.
--    ⛔ One sweep, in one place, with a fixed domain — two copies of a
--    catalog-absence claim is how one of them goes stale unnoticed.
-- ============================================================================

-- ============================================================================
-- § 8 THE SIBLING PIN — the read door and the picker must move TOGETHER.
--
--     ⛔ QA finding B1 is that `addStaff` (the WRITE twin) kept gating on the
--        column after `list_addable_commission_members` (the READ twin) moved off
--        it, under a comment claiming the two mirrored "exactly".  Three
--        predicates now say the same thing in three places; the TS one is pinned
--        in `src/lib/queries/org-roster-predicate.test.ts`, and the two SQL ones
--        are re-derived from the CATALOG here every run — so a fix applied to one
--        sibling and not the other reds instead of shipping.
-- ============================================================================

select is(
  (select count(distinct pred)::text || '|' || count(*)::text from (
     select regexp_replace(
              regexp_replace(
                substring(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g')
                          from 'from public\.organization_affiliations oa where.*?voided_at is null'),
                'oa\.principal_id = (pr\.id|p_person)', 'oa.principal_id = <PERSON>', 'g'),
              'oa\.organization_id = (v_org_id|p_organization)', 'oa.organization_id = <ORG>', 'g') as pred
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'public' and p.proname = 'list_addable_commission_members')
         or (n.nspname = 'app'    and p.proname = 'person_has_active_org_affiliation')) s
    where pred is not null),
  '1|2',
  '8.1 ⭐⭐ THE SIBLING PIN, DERIVED FROM THE CATALOG: the roster door and the picker''s helper carry the SAME tense predicate once person and organisation are normalised (2 functions, 1 distinct predicate). QA B1''s defect was a comment CLAIMING that mirror while one side had moved — this re-derives it every run, so the claim cannot rot');

-- ============================================================================
-- § 9 ADR 0164'S REQUIRED MITIGATION GETS A REACHABLE HALF (QA finding M3).
--
--     ⛔ `app.tenant_orphan_profiles()` was well-built, correctly discriminated
--        and UNREACHABLE: PostgREST exposes only `public`, so no application
--        process could ever call it — the "correct door nothing can reach" shape.
--        A grant on the `app` function would have been a fix that changes nothing.
--
--     ⛔ The wrapper is in NO arm's finding domain (set-returning, not boolean;
--        DEFINER, so not ARM=wrapper's; not `authenticated`-executable, so
--        neither census clause 1 nor ARM=floor admits it).  Absence of a verdict
--        is absence of coverage — these three assertions are the compensating
--        control, and they carry verdicts of their own.
-- ============================================================================

select is(
  (select string_agg(d.label || '=' || w.reason, ',' order by d.label)
     from public.tenant_orphan_profiles() w
     join d_targets d on d.target = w.profile_id),
  'D3=all_voided,D5=never_affiliated',
  '9.0 ⛔ THE NON-VACUITY FLOOR, AND IT IS NOT DECORATION: the SEED CONTAINS ZERO ORPHANS (its only affiliation-less profile is the platform_admin, whom the detector correctly excludes), so on the seed alone § 9.2 compares two EMPTY sets and § 9.3 counts inside one — both green having asserted nothing. This suite''s own § 2 fixture supplies the two real shapes, and this cell pins BOTH the membership and the REASON, so a detector that found them for the wrong reason reds here');

select is(
  (select has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '|' ||
          has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '|' ||
          has_function_privilege('anon', p.oid, 'EXECUTE')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tenant_orphan_profiles'),
  'true|false|false',
  '9.1 the reachable half is SERVICE-ROLE ONLY. ⚠ A row-returning DEFINER is a gate you WALK THROUGH rather than one you can neutralize, and this one enumerates exactly the people no tenant admin can reach — so the ACL is the whole boundary, asserted positively per role rather than by reading proacl for absence');

select is(
  (select count(*)::text from public.tenant_orphan_profiles() w
     full join app.tenant_orphan_profiles() a
       on a.profile_id = w.profile_id and a.reason = w.reason
    where w.profile_id is null or a.profile_id is null),
  '0',
  '9.2 PURE DELEGATION, re-derived rather than reviewed: the wrapper''s rows and the `app` function''s rows agree exactly, in both directions. A wrapper that filtered, capped or re-implemented the discrimination would red here — and a second copy of the `is_admin` judgement is the drift this phase has paid for repeatedly');

select is(
  (select count(*)::text from public.tenant_orphan_profiles() w
    where w.profile_id in (select id from public.profiles where is_admin)),
  '0',
  '9.3 the `is_admin` DISCRIMINATOR survives the wrapper: the platform_admin has zero non-voided org affiliations and is STILL not reported. ⚠ Not a restatement of § 9.2 — § 9.2 would stay green if BOTH functions named the platform admin, which is precisely the failure a detector keyed on absence alone produces');

select * from finish();
rollback;
