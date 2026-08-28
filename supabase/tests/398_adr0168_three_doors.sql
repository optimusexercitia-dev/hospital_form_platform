-- ADR 0168 (+ Amendment 1, PO-ruled 2026-08-28) — THE THREE-DOOR SPLIT.
-- Migration: 20261003006100_adr0168_three_doors_orphan_recovery.sql
-- Companion suite: `393`, which carries the BEHAVIOURAL differential (which STATE each
-- door admits, per tier, per authority arm).  THIS file carries the three things `393`
-- structurally cannot:
--   § 1  the family's ACL surface, as an exact tuple per door;
--   § 2  the REACHABILITY of the new wrappers, measured by calling them under a role
--        rather than by reading `has_function_privilege` — the SQL is truth about the
--        SQL and evidence about nothing downstream;
--   § 3  the RECOVERY door, which has no cell in `393` at all (it is not an
--        affiliation-creating door in the `ae24_gate` sense — different actor,
--        different predicate, different verb);
--   § 4  the AUDIT VERBS, which are the half of ADR 0168 that makes the split legible
--        after the fact rather than only enforceable at the door.
--
-- ============================================================================
-- ⛔ WHY THE ACL IS THE SUBJECT OF § 1 AND NOT A FOOTNOTE
-- ============================================================================
-- ADR 0168 Amdt 1's own diagnosis, quoted because it is the whole design:
--
--   > The split cannot be a predicate over state; it has to be a split over DOORS,
--   > because the door's ACL is the only durable discriminator left.
--
-- Once `home_organization_id` is dropped, an anchorless person and a just-created
-- person are the SAME DB STATE.  No predicate can separate them.  So the CREATION
-- doors' bound is not their predicate — it is that `authenticated` cannot reach them.
-- ⚠ That makes an ACL regression here a SEMANTIC regression, not a hardening lapse: a
-- `grant execute … to authenticated` on `public.affiliate_new_person_for` restores the
-- exact widening ADR 0168 exists to close, and every behavioural cell in `393` stays
-- green while it does.
--
-- ============================================================================
-- ⚖ THE RULING THIS FILE RECORDS AS AN ASSERTION (§ 1.2)
-- ============================================================================
-- ADR 0168 Amdt 1's third cost: `public.affiliate_person_to_org` holds `authenticated`
-- EXECUTE with ZERO production TypeScript call sites — reachable and uncalled.  The
-- lead RULED on 2026-08-28 to KEEP the grant: it is the org-tier ORDINARY door,
-- symmetric with `public.affiliate_person`; after the narrowing it carries the NARROW
-- predicate, so the exposure is closed BY THE NARROWING rather than by the grant; and
-- revoking it would delete real exercised coverage (`379 § 2` / `§ 5.1`, `380`, and
-- `303_dominance_grid` names it) in exchange for a surface reduction on a door that is
-- no longer wide.  ⭐ § 1.2 PINS the grant so the ruling is a decision with a witness
-- rather than an accident nobody re-examines — and so that a future revoke has to be a
-- deliberate act that reds this cell first.
--
-- ============================================================================
-- ⚠ NON-VACUITY IS EXPLICIT THROUGHOUT, because this repo's dominant defect family is
--   assertions that pass while proving nothing.  Concretely, in this file:
--     • every ACCEPT cell is followed by a WRITE-THROUGH cell (the row exists, of the
--       right kind, anchored to the right person and organisation) — `lives_ok` cannot
--       see whether its own statement did anything;
--     • every DENY cell has a POSITIVE CONTROL naming what would otherwise explain the
--       refusal — an actor that is genuinely entitled elsewhere, a subject that is
--       genuinely present, a role that can genuinely call something;
--     • § 4.0 asserts the `audit_trail` FLAG IS ON before any audit cell runs.
--       `app.audit_write` RETURNS SILENTLY when it is off, so a flag gap would make
--       § 4.3/§ 4.4 ("the ordinary doors do NOT emit …") pass for the wrong reason
--       while § 4.1/§ 4.2 red — an asymmetry that reads as a real finding.
--
-- ⚠ RUN SHAPE.  Requires `00_setup.sql` for `test_helpers`.  Expected shape
--   `Files=2, Tests=26` (25 here + `00_setup.sql`'s own one).
--
-- Assertion count: 25
-- ============================================================================
begin;
select plan(25);

-- ---------------------------------------------------------------------------
-- Constants.  Seed ids only; every constructed id lives in a `0168…` namespace
-- disjoint from 390-397, so nothing is shared across cases.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (org_a uuid, org_b uuid, platform uuid, orgadmin_a uuid, hosp_admin uuid,
               central_a uuid, no_such_org uuid, no_such_person uuid)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         '00000000-0000-0000-0000-0000000000b0'::uuid,  -- platform@test.local
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- orgadmin.a
         '00000000-0000-0000-0000-0000000000e1'::uuid,  -- hospitaladmin.a1 (central-a ONLY)
         '05000000-0000-0000-0000-00000000000a'::uuid,  -- Hospital Central A
         '0c000000-0000-0000-0000-016800000fff'::uuid,  -- no such organisation
         '00000000-0000-0000-0000-016800000fff'::uuid;  -- no such profile
$$;
-- § 2 and § 3 drive real calls under `set local role authenticated`, and the `format(…)`
-- that builds each statement is evaluated by THAT role — so without this grant the
-- suite aborts with `permission denied for function k` instead of asserting anything.
grant execute on function pg_temp.k() to authenticated;

-- ============================================================================
-- § 1 THE ACL SURFACE OF THE WHOLE FAMILY — SEVEN BODIES, FIVE WRAPPERS.
--
--     ⭐ ASSERTED AS ONE EXACT STRING NAMING EVERY FUNCTION, not as a set of
--     per-function cells and not as a count.  Two reasons:
--       • a per-function cell says nothing about a door that has APPEARED — the
--         "new door must inherit every sibling arm" shape, which this phase has hit
--         repeatedly; a whole-family string reds on an addition as well as on a
--         change; and
--       • it is derived POSITIVELY via `has_function_privilege`, never by reading
--         `proacl` for an absence. A NULL `proacl` INCLUDES PUBLIC — the guard that
--         reads right and fails open, hit four times in this estate.
-- ============================================================================
select is(
  (select string_agg(n.nspname || '.' || p.proname || '=' ||
            case when p.prosecdef then 'D' else 'I' end ||
            case when has_function_privilege('authenticated', p.oid, 'execute') then 'a' else '-' end ||
            case when has_function_privilege('service_role',  p.oid, 'execute') then 's' else '-' end ||
            case when has_function_privilege('anon',          p.oid, 'execute') then 'n' else '-' end,
          ' ' order by n.nspname, p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'app' and p.proname in (
             'affiliate_person_impl', 'affiliate_person_to_org_impl',
             'affiliate_new_person_impl', 'affiliate_new_person_to_org_impl',
             'recover_orphan_person_to_org_impl',
             'person_known_to_org', 'person_is_anchorless'))
       or (n.nspname = 'public' and p.proname in (
             'affiliate_person', 'affiliate_person_for',
             'affiliate_person_to_org', 'affiliate_person_to_org_for',
             'affiliate_new_person_for', 'affiliate_new_person_to_org_for',
             'recover_orphan_person_to_org'))),
  'app.affiliate_new_person_impl=D--- app.affiliate_new_person_to_org_impl=D--- '
  || 'app.affiliate_person_impl=D--- app.affiliate_person_to_org_impl=D--- '
  || 'app.person_is_anchorless=D--- app.person_known_to_org=D--- '
  || 'app.recover_orphan_person_to_org_impl=D--- '
  || 'public.affiliate_new_person_for=D-s- public.affiliate_new_person_to_org_for=D-s- '
  || 'public.affiliate_person=Das- public.affiliate_person_for=D-s- '
  || 'public.affiliate_person_to_org=Das- public.affiliate_person_to_org_for=D-s- '
  || 'public.recover_orphan_person_to_org=Da--',
  '1.1 ⭐⭐ THE FAMILY ACL MATRIX, exact and whole (D=DEFINER, a/s/n = authenticated/service_role/anon EXECUTE). All seven `app` bodies are owner-only; the two CREATION wrappers are service_role ONLY — which per ADR 0168 Amdt 1 IS the bound, not a hardening extra; the RECOVERY wrapper is authenticated-only (its caller is a signed-in platform_admin, and service_role has no business bypassing the platform_admin gate). Naming every function means a NEW door in this family reds here instead of inheriting nothing');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'affiliate_person_to_org'),
  'true',
  '1.2 ⚖ THE RULING, RECORDED AS AN ASSERTION: `public.affiliate_person_to_org` KEEPS its `authenticated` EXECUTE. ADR 0168 Amdt 1 flagged it as reachable-and-uncalled and required a ruling in this increment; the lead ruled KEEP (2026-08-28) because after the narrowing it carries the NARROW predicate — the exposure is closed by the narrowing, not by the grant — and revoking it would delete exercised coverage in `379`/`380`/`303`. ⛔ Its own cell, so a future revoke must red a verdict that NAMES the ruling rather than silently shrinking 1.1');

select is(
  (select string_agg(p.proname || '=' || array_to_string(p.proconfig, ','), ' ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'app' and p.proname in (
             'affiliate_new_person_impl', 'affiliate_new_person_to_org_impl',
             'recover_orphan_person_to_org_impl', 'person_known_to_org', 'person_is_anchorless'))
       or (n.nspname = 'public' and p.proname in (
             'affiliate_new_person_for', 'affiliate_new_person_to_org_for',
             'recover_orphan_person_to_org'))),
  'affiliate_new_person_for=search_path=app, public, pg_catalog '
  || 'affiliate_new_person_impl=search_path=app, public, pg_catalog '
  || 'affiliate_new_person_to_org_for=search_path=app, public, pg_catalog '
  || 'affiliate_new_person_to_org_impl=search_path=app, public, pg_catalog '
  || 'person_is_anchorless=search_path=app, public, pg_catalog '
  || 'person_known_to_org=search_path=app, public, pg_catalog '
  || 'recover_orphan_person_to_org=search_path=app, public, pg_catalog '
  || 'recover_orphan_person_to_org_impl=search_path=app, public, pg_catalog',
  '1.3 every one of the EIGHT objects this migration creates pins its `search_path` — a SECURITY DEFINER without one is the resolution-hijack shape, and all eight are DEFINER by § 1.1. Asserted as a string of NAME=VALUE pairs, so a function that vanished from the domain reds instead of shrinking the aggregate');

-- ⭐ The gating of the two named predicates is not asserted in the abstract: it is
--   asserted to EQUAL `app.person_authority_orgs`, the function the migration says it
--   mirrors. An absolute assertion goes stale silently when the estate's convention
--   moves; a RELATIVE one reds when the two drift apart, which is the actual claim.
select is(
  (select string_agg(p.proname || '=' || p.prosecdef::text || '/' ||
            has_function_privilege('authenticated', p.oid, 'execute')::text || '/' ||
            has_function_privilege('service_role', p.oid, 'execute')::text, ' ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in ('person_authority_orgs', 'person_is_anchorless', 'person_known_to_org')),
  'person_authority_orgs=true/false/false person_is_anchorless=true/false/false person_known_to_org=true/false/false',
  '1.4 ⭐ the two NAMED PREDICATES are gated EXACTLY as `app.person_authority_orgs` is — DEFINER, owner-only — and the anchor is asserted in the SAME string rather than cited. A boolean oracle over "does this uuid have tenancy anywhere", reachable by `authenticated`, is an enumeration primitive over `profiles.id`; and if the estate ever regates `person_authority_orgs`, this cell reds and forces the question instead of quietly keeping an absolute number that used to mean something');

-- ============================================================================
-- § 2 REACHABILITY, MEASURED BY CALLING — not by reading a privilege bit.
--     ⛔ § 1.1 is truth about the CATALOG and evidence about nothing downstream.
--     PostgREST reaches a function through the `authenticated` role, so the question
--     that matters is what happens when that role calls it.
--     ⚠ AND THE DISCRIMINATION IS ON THE MESSAGE, NOT THE CODE: a missing EXECUTE
--       grant and the recovery door's OWN authority refusal are BOTH `42501`. A
--       code-only assertion here would be satisfied by the wrong refusal — the exact
--       shape `393 § 2.1` calls out on its own table.
-- ============================================================================
select test_helpers.claims_for((select orgadmin_a from pg_temp.k()), false, 'org_admin');
set local role authenticated;

select throws_ok(
  format($$select public.affiliate_new_person_to_org_for(%L::uuid, %L::uuid, %L::uuid, null)$$,
         (select orgadmin_a from pg_temp.k()), (select platform from pg_temp.k()),
         (select org_a from pg_temp.k())),
  '42501',
  'permission denied for function affiliate_new_person_to_org_for',
  '2.1 ⭐⭐ an `authenticated` caller CANNOT REACH the org CREATION door — refused by the GRANT, matched on the Postgres message so it cannot be confused with the door''s own `sem permissão`. This is the assertion ADR 0168 Amdt 1''s "the door''s ACL is the only durable discriminator left" reduces to: the caller here is a REAL org_admin of the target organisation, so the door''s authority arm would have ADMITTED him');

select throws_ok(
  format($$select public.affiliate_new_person_for(%L::uuid, %L::uuid, %L::uuid, null, null, null, null, null)$$,
         (select orgadmin_a from pg_temp.k()), (select platform from pg_temp.k()),
         (select central_a from pg_temp.k())),
  '42501',
  'permission denied for function affiliate_new_person_for',
  '2.2 …and the hospital CREATION door likewise. Both siblings asserted, in the same increment: the estate''s repeated defect is one axis swept and its twin left, and an ACL is exactly the kind of thing granted one function at a time');

-- ⭐ THE POSITIVE CONTROL FOR § 2.1/§ 2.2, and it is load-bearing: without it a
--   `set local role authenticated` that silently failed, or a role with no EXECUTE on
--   ANYTHING, produces the same two 42501s. The recovery wrapper IS granted to
--   `authenticated`, so this call must get PAST the grant and fail on the door's own
--   authority arm — a DIFFERENT message, which is the whole discrimination.
select throws_ok(
  format($$select public.recover_orphan_person_to_org(%L::uuid, %L::uuid, null)$$,
         (select platform from pg_temp.k()), (select org_a from pg_temp.k())),
  '42501',
  'sem permissão',
  '2.3 ⭐⭐ POSITIVE CONTROL **and** the recovery door''s DENY cell in one: the same `authenticated` role, calling the RECOVERY wrapper it DOES hold EXECUTE on, gets past the grant and is refused by the door''s own platform_admin arm — `sem permissão`, not `permission denied for function`. So 2.1/2.2 measure the GRANT (the role can evidently call things), and this measures the ARM: an org_admin of the target organisation may NOT recover an orphan');
reset role;

-- ⭐ AND THE ACL DID NOT REPLACE THE AUTHORITY ARM — the creation doors have TWO
--   gates, not one. ADR 0168 Amdt 1 says the ACL is "the only durable discriminator
--   left" BETWEEN THE TWO POPULATIONS; it does not say the door stopped asking who is
--   calling. A door that traded its authority arm for its ACL would let any
--   service_role code path affiliate anyone anywhere, and no cell in `393` would move
--   (its H-cells all use entitled actors). The POSITIVE CONTROL for this refusal is
--   § 4.2: the SAME actor succeeds through the HOSPITAL creation door, where he does
--   hold an arm.
select throws_ok(
  format($$select app.affiliate_new_person_to_org_impl(%L::uuid, %L::uuid, %L::uuid, null)$$,
         (select hosp_admin from pg_temp.k()), (select platform from pg_temp.k()),
         (select org_a from pg_temp.k())),
  '42501',
  'sem permissão',
  '2.5 ⭐⭐ THE CREATION DOOR KEEPS ITS SIBLING''S AUTHORITY ARM: a `hospital_admin` — who holds NO org_admin membership anywhere (`393 § 5.0` pins that) — is refused by the ORG creation door even though the door is being called with owner privileges, i.e. past its ACL entirely. The two gates are independent: the ACL bounds WHICH POPULATION is admissible, the arm bounds WHO may act. § 4.2 is the positive control — the same actor succeeds through the hospital creation door, where he does hold an arm');

select is(
  app.is_org_admin_of_for((select org_a from pg_temp.k()), (select orgadmin_a from pg_temp.k()))::text
  || '|' || app.is_admin_for((select orgadmin_a from pg_temp.k()))::text,
  'true|false',
  '2.4 ⛔ NON-VACUITY OF 2.3: the refused actor genuinely IS an org_admin of the target organisation and genuinely is NOT a platform_admin. Without this, 2.3 is satisfied by an actor with no authority anywhere, and the cell would read as "the recovery door refuses org_admins" while actually proving "the door refuses nobodies"');

-- ============================================================================
-- § 3 THE RECOVERY DOOR — accept, deny-by-actor (§ 2.3 above), deny-by-subject,
--     and the two conflations it inherits from its siblings.
-- ============================================================================
create temp table r168 (k text primary key, v uuid);

-- P1 the ORPHAN (recovery accept subject) · P2 a NON-orphan, ACTIVE in org A
-- (the strictness bound's subject) · P3-P7 the § 4 audit subjects.
insert into r168 (k, v) values
  ('p1_orphan',        '00000000-0000-0000-0000-016800000001'),
  ('p2_anchored',      '00000000-0000-0000-0000-016800000002'),
  ('p3_org_create',    '00000000-0000-0000-0000-016800000003'),
  ('p4_hosp_create',   '00000000-0000-0000-0000-016800000004'),
  ('p5_org_ordinary',  '00000000-0000-0000-0000-016800000005'),
  ('p6_hosp_ordinary', '00000000-0000-0000-0000-016800000006'),
  ('p7_idempotent',    '00000000-0000-0000-0000-016800000007');
-- Same reason as the `pg_temp.k()` grant above: § 3's statements are BUILT under
-- `set local role authenticated`, so that role has to be able to read the id table.
grant select on r168 to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', r.v, 'authenticated', 'authenticated',
       r.v || '@adr168.test', now(), now()
from r168 r;

update public.profiles set is_active = true, full_name = 'ADR0168 fixture'
 where id in (select v from r168);

-- P2 and P5 are ACTIVE in org A; P6 is ENDED-but-non-voided in org A (the D5 rehire
-- state, which `person_known_to_org` admits and `person_is_anchorless` refuses).
-- P1, P3, P4 and P7 deliberately get NO affiliation row at all.
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, created_by)
values
  ((select v from r168 where k = 'p2_anchored'),     (select org_a from pg_temp.k()), date '2025-01-01', null, null, (select orgadmin_a from pg_temp.k())),
  ((select v from r168 where k = 'p5_org_ordinary'), (select org_a from pg_temp.k()), date '2025-01-01', null, null, (select orgadmin_a from pg_temp.k())),
  ((select v from r168 where k = 'p6_hosp_ordinary'),(select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select orgadmin_a from pg_temp.k()), (select orgadmin_a from pg_temp.k()));

select is(
  app.person_is_anchorless((select v from r168 where k = 'p1_orphan'))::text || '|' ||
  app.person_is_anchorless((select v from r168 where k = 'p2_anchored'))::text,
  'true|false',
  '3.0 ⛔ FIXTURE PRECONDITION, asserted rather than assumed: P1 really is anchorless and P2 really is not. The two subjects of § 3.1 and § 3.3 differ in EXACTLY this property, so if the fixture ever stopped constructing the orphan, 3.1 would fail loudly here instead of 3.3 passing for the wrong reason');

-- ---------------------------------------------------------------------------
-- § 3.1 THE ACCEPT, THROUGH THE PUBLIC WRAPPER AS A SIGNED-IN PLATFORM ADMIN.
--   ⚠ Driven through `public.recover_orphan_person_to_org` and not the impl, because
--     the impl takes `p_actor` as a PARAMETER while the wrapper derives it from
--     `auth.uid()` — and `app.is_admin_for` carries the ACT caller-hat clause
--     (ADR 0106 D11), which only has anything to bite on when the actor IS the caller.
--     Calling the impl directly would silently skip the hat.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select platform from pg_temp.k()), true, 'platform_admin');
set local role authenticated;

select lives_ok(
  format($$select public.recover_orphan_person_to_org(%L::uuid, %L::uuid, null)$$,
         (select v from r168 where k = 'p1_orphan'), (select org_a from pg_temp.k())),
  '3.1 ⭐⭐ ACCEPT: a signed-in `platform_admin`, wearing the platform_admin hat, recovers an ORPHAN into org A through the public wrapper. This is ADR 0168 § Decision 2 — orphan recovery is a real need (an orphan is in no roster and reachable only by uuid, so removing the path entirely strands them), performed by a DIFFERENT ACTOR through a DIFFERENT DOOR rather than as a side effect of the ordinary affiliation door');

select throws_ok(
  format($$select public.recover_orphan_person_to_org(%L::uuid, %L::uuid, null)$$,
         (select v from r168 where k = 'p2_anchored'), (select org_a from pg_temp.k())),
  'HC0R0',
  'pessoa não é órfã',
  '3.3 ⭐⭐ THE STRICTNESS BOUND: the SAME platform_admin, in the SAME transaction, is REFUSED on a person who is already anchored. Recovery is for orphans ONLY — a person anchored somewhere is administered through the ordinary door by their own tenant''s admin, and routing them through here would let a platform_admin move employment records, which the ADR 0041 noun rule forbids. ⭐ Because 3.1 succeeded for this actor moments ago, this refusal is provably about the SUBJECT and not about the caller');

select throws_ok(
  format($$select public.recover_orphan_person_to_org(%L::uuid, %L::uuid, null)$$,
         (select no_such_person from pg_temp.k()), (select org_a from pg_temp.k())),
  'HC0R0',
  'pessoa não pertence a esta organização',
  '3.4 the EXISTENCE CONFLATION is inherited, verbatim: a profile that does not exist is refused with the same code AND the same pt-BR message the siblings use for "wrong organisation". ⚠ Kept even though the caller is a platform_admin who could enumerate `profiles` anyway — the value is that the DOOR has one refusal shape, so a future ACL widening cannot turn it into an oracle by accident. ⭐ And note it is a DIFFERENT message from 3.3''s, so the two refusals are distinguishable to a reader and to a UI without being distinguishable to a prober of ids');

select throws_ok(
  format($$select public.recover_orphan_person_to_org(%L::uuid, %L::uuid, null)$$,
         (select v from r168 where k = 'p3_org_create'), (select no_such_org from pg_temp.k())),
  'HC0R5',
  'organização inexistente',
  '3.5 the ORG-EXISTENCE guard, which is DELIBERATELY NEW rather than inherited: the ordinary org door gets it free (`is_org_admin_of_for` is false for a non-existent organisation, and the 42501 conflation is correct there), but `is_admin_for` is org-independent, so without this guard a typo''d uuid reaches the caller as a raw 23503 FK violation — a raw Postgres error in the UI. There is no tenancy-oracle concern: by the noun rule a platform_admin already enumerates organisations. ⭐ The SUBJECT is a genuine orphan, so the refusal is provably about the ORG and not about the person');
reset role;

select is(
  (select count(*)::int || '|' || max(created_by::text) || '|' || max(organization_id::text)
     from public.organization_affiliations
    where principal_id = (select v from r168 where k = 'p1_orphan')
      and ended_on is null and voided_at is null),
  '1|' || (select platform from pg_temp.k())::text || '|' || (select org_a from pg_temp.k())::text,
  '3.2 ⛔ WRITE-THROUGH FOR 3.1: the recovery really produced ONE live, non-ended, non-voided affiliation of P1 to org A, CREATED BY the platform admin. `lives_ok` cannot see whether its own statement did anything — a door that accepted and returned early would leave 3.1 green and only this cell red, which is the "accepts and silently does nothing" regression QA finding B3 names');

select is(
  app.person_is_anchorless((select v from r168 where k = 'p1_orphan'))::text || '|' ||
  app.person_known_to_org((select v from r168 where k = 'p1_orphan'), (select org_a from pg_temp.k()))::text,
  'false|true',
  '3.6 ⭐ …and THIS is why recovery is ORG TIER ONLY, measured rather than argued: after recovery P1 is no longer anchorless and IS known to org A — so `app.person_known_to_org` is now true and the ORDINARY hospital door admits them on the very next call. A hospital-tier recovery door would be a second way to do what the ordinary hospital door already does after this one runs');


-- ============================================================================
-- § 4 THE AUDIT VERBS.  ADR 0168 § Consequences makes a distinct verb REQUIRED,
--     not optional: "recovery must be distinguishable in the trail from an ordinary
--     affiliation", and the creation doors carry the same requirement.
--
--     ⚠ THE TABLE TRIGGERS STILL FIRE.  `app.trg_audit_organization_affiliations` and
--       `trg_audit_hospital_affiliations` key on `tg_op` and CANNOT know which door
--       inserted, so the trail carries the ROW FACT (`…created`, from the trigger) AND
--       the ACT (`…created_on_registration` / `…recovered`, from the door). Every cell
--       below therefore asserts the FULL SET of actions for one entity, never the
--       presence of one row — a "contains" assertion could not see an extra verb, and
--       an extra verb on a door is exactly what an accidental copy-paste produces.
--
--     ⛔⛔ EACH DOOR IS CALLED IN ITS OWN STATEMENT, AND THAT IS A CORRECTNESS
--       REQUIREMENT, NOT A STYLE CHOICE.  The first draft of this section embedded the
--       call in the assertion's own `where al.entity_id = app.<door>(…)`.  Every such
--       cell reported `(none)`: a statement reads the snapshot taken at its start, so
--       a door called INSIDE the query cannot have its own audit rows seen BY that
--       query.  ⚠ That failure is silent and reads exactly like "the door emits no
--       verb" — a fabricated defect, and in the opposite arrangement it would have
--       been a fabricated all-clear.  The ids are therefore materialised first.
-- ============================================================================
select is(
  app.feature_enabled('audit_trail')::text, 'true',
  '4.0 ⛔ NON-VACUITY PRECONDITION FOR ALL OF § 4: the `audit_trail` flag is ON. `app.audit_write` RETURNS SILENTLY when it is off — which would red 4.1/4.2 while making 4.3/4.4 ("the ordinary doors emit NO registration verb") pass for entirely the wrong reason. A flag gap that silently skips keystones has already happened in this estate''s pgTAP fixtures; this is the cheap guard against it');

create temp table r168_ids (k text primary key, id uuid);

-- The four door calls, each its own statement so the audit rows it writes are visible
-- to the assertions below.  ⭐ The ACTORS are chosen to exercise different arms:
--   org creation      — orgadmin.a  (the only arm the org tier has)
--   hospital creation — hospitaladmin.a1 (the HOSPITAL arm, i.e. `ensureActiveAffiliation`'s)
--   ordinary org      — orgadmin.a  on P6, whose org-A row is ENDED but NON-VOIDED
--   ordinary hospital — hospitaladmin.a1 on P5, who is ACTIVE in org A
insert into r168_ids (k, id) values
  ('org_creation', app.affiliate_new_person_to_org_impl(
      (select orgadmin_a from pg_temp.k()), (select v from r168 where k = 'p3_org_create'),
      (select org_a from pg_temp.k()), null));

insert into r168_ids (k, id) values
  ('hosp_creation', app.affiliate_new_person_impl(
      (select hosp_admin from pg_temp.k()), (select v from r168 where k = 'p4_hosp_create'),
      (select central_a from pg_temp.k()), null, null, null, null, null));

insert into r168_ids (k, id) values
  ('org_ordinary', app.affiliate_person_to_org_impl(
      (select orgadmin_a from pg_temp.k()), (select v from r168 where k = 'p6_hosp_ordinary'),
      (select org_a from pg_temp.k()), null));

insert into r168_ids (k, id) values
  ('hosp_ordinary', app.affiliate_person_impl(
      (select hosp_admin from pg_temp.k()), (select v from r168 where k = 'p5_org_ordinary'),
      (select central_a from pg_temp.k()), null, null, null, null, null));

select is(
  (select coalesce(string_agg(distinct al.action, ',' order by al.action), '(none)')
     from public.audit_log al
    where al.entity_type = 'organization_affiliation'
      and al.entity_id = (select id from r168_ids where k = 'org_creation')),
  'org_affiliation.created,org_affiliation.created_on_registration',
  '4.1 ⭐⭐ the ORG CREATION door emits BOTH rows for the row it creates: the trigger''s `org_affiliation.created` (the ROW FACT) and the door''s own `org_affiliation.created_on_registration` (the ACT). ⛔ Asserted as the EXACT SET for that entity, so an extra verb reds too — the trigger cannot know which door inserted, so the door''s verb is the only thing in the trail that distinguishes a registration from an ordinary affiliation');

select is(
  (select coalesce(string_agg(distinct al.action, ',' order by al.action), '(none)')
     from public.audit_log al
    where al.entity_type = 'hospital_affiliation'
      and al.entity_id = (select id from r168_ids where k = 'hosp_creation')),
  'affiliation.created,affiliation.created_on_registration',
  '4.2 …and the HOSPITAL CREATION door likewise, driven through the `hospital_admin` arm — the arm `ensureActiveAffiliation` uses. Both siblings in the same increment, because this estate''s repeated defect is one axis swept and its twin left. ⭐ This cell is also § 2.5''s POSITIVE CONTROL: the actor § 2.5 shows the ORG creation door refusing is the actor succeeding here, so that refusal is about the missing arm and not about a powerless principal');

select is(
  (select coalesce(string_agg(distinct al.action, ',' order by al.action), '(none)')
     from public.audit_log al
    where al.entity_type = 'organization_affiliation'
      and al.entity_id = (select id from r168_ids where k = 'org_ordinary')),
  'org_affiliation.created',
  '4.3 ⭐⭐ THE ORDINARY ORG DOOR EMITS THE ROW FACT AND NOTHING ELSE. P6 is ENDED-but-non-voided in org A, so `person_known_to_org` admits them and the door genuinely INSERTS — the trigger''s `org_affiliation.created` is PRESENT, which proves auditing was live at that instant, and `org_affiliation.created_on_registration` is ABSENT. ⛔ Presence and absence in ONE exact-set assertion: an absence measured beside a presence cannot be the audit system simply not running, which is the whole reason this cell is not "count of registration verbs = 0"');

select is(
  (select coalesce(string_agg(distinct al.action, ',' order by al.action), '(none)')
     from public.audit_log al
    where al.entity_type = 'hospital_affiliation'
      and al.entity_id = (select id from r168_ids where k = 'hosp_ordinary')),
  'affiliation.created',
  '4.4 …and the ORDINARY HOSPITAL door likewise: P5 is ACTIVE in org A, so the door admits and inserts, the trigger''s `affiliation.created` lands, and no registration verb appears beside it. The ordinary/creation distinction has to hold at BOTH tiers or the trail can only answer the question for one of them');

select is(
  (select count(*)::int from public.audit_log al
    where al.entity_type = 'organization_affiliation'
      and al.action = 'org_affiliation.recovered'
      and al.entity_id = (select id from public.organization_affiliations
                           where principal_id = (select v from r168 where k = 'p1_orphan')
                             and ended_on is null and voided_at is null)
      and al.actor_id = (select platform from pg_temp.k())
      and al.organization_id = (select org_a from pg_temp.k())
      and al.metadata ->> 'user_id' = (select v from r168 where k = 'p1_orphan')::text
      and al.metadata ->> 'actor_user_id' = (select platform from pg_temp.k())::text), 1,
  '4.5 ⭐⭐ § 3.1''s recovery landed an `org_affiliation.recovered` row NAMING the recovered person, the acting platform admin and the organisation. ADR 0168 § Consequences: "its own audit verb is required, not optional — recovery must be distinguishable in the trail from an ordinary affiliation". ⭐ Every component is asserted in ONE row-match, so a verb written with the right name but the wrong subject, actor or tenant reds');

select is(
  (select count(*)::int from public.audit_log al
    where al.action in ('org_affiliation.created_on_registration', 'affiliation.created_on_registration',
                        'org_affiliation.recovered')
      and (al.entity_id in (select id from public.organization_affiliations
                             where principal_id in ((select v from r168 where k = 'p5_org_ordinary'),
                                                    (select v from r168 where k = 'p6_hosp_ordinary')))
        or al.entity_id in (select id from public.hospital_affiliations
                             where principal_id in ((select v from r168 where k = 'p5_org_ordinary'),
                                                    (select v from r168 where k = 'p6_hosp_ordinary'))))), 0,
  '4.6 …and NONE of the three new verbs is attached to ANY row of the two ordinary-door subjects — swept across all three verbs and BOTH affiliation tables at once, rather than one entity at a time. 4.3/4.4 are scoped to the id the door returned; a copy-pasted `audit_write` that named a DIFFERENT entity (the org parent, say) would satisfy them both and only red here');

-- ---------------------------------------------------------------------------
-- § 4.7 THE IDEMPOTENT PATH EMITS NO ACT.  The creation doors return early on an
--   existing ACTIVE row, ABOVE their `audit_write`. That is deliberate: an idempotent
--   re-call emitting `…created_on_registration` would put an act in the trail that
--   never happened, and would make the verb uncountable for anyone auditing
--   registrations. ⭐ The count AFTER THE FIRST CALL is captured before the second one
--   runs, so the second call's zero is a DIFFERENCE and not an absence.
--   ⚠ Same snapshot rule as the rest of § 4 — the two calls and the intermediate count
--     are three separate statements, not one CTE.
-- ---------------------------------------------------------------------------
insert into r168_ids (k, id) values
  ('idem_1', app.affiliate_new_person_to_org_impl(
      (select orgadmin_a from pg_temp.k()), (select v from r168 where k = 'p7_idempotent'),
      (select org_a from pg_temp.k()), null));

create temp table r168_idem as
  select (select count(*)::int from public.audit_log
           where action = 'org_affiliation.created_on_registration'
             and entity_id = (select id from r168_ids where k = 'idem_1')) as n_after_first;

insert into r168_ids (k, id) values
  ('idem_2', app.affiliate_new_person_to_org_impl(
      (select orgadmin_a from pg_temp.k()), (select v from r168 where k = 'p7_idempotent'),
      (select org_a from pg_temp.k()), null));

select is(
  (select n_after_first from r168_idem)::text || '|' ||
  ((select id from r168_ids where k = 'idem_2') = (select id from r168_ids where k = 'idem_1'))::text || '|' ||
  (select count(*)::int from public.audit_log
    where action = 'org_affiliation.created_on_registration'
      and entity_id = (select id from r168_ids where k = 'idem_1'))::text,
  '1|true|1',
  '4.7 ⭐ IDEMPOTENCY IS AUDIT-SILENT: the first call emits exactly ONE `…created_on_registration`, the second call returns THE SAME id (so it really took the idempotent branch rather than inserting a duplicate the partial unique would have rejected), and the count is STILL one. All three components in one string — without the middle one, a door that RAISED on the second call would also show `1|…|1`');

-- ---------------------------------------------------------------------------
-- § 4.8 THE VERBS ARE NEW TO THE ESTATE, and `public.audit_log.action` carries only a
--   `position('.' in action) > 1` CHECK — no enum, so nothing else would have objected
--   to a typo. A misspelled verb inserts happily and simply never matches any query
--   anyone later writes. This is the spelling pin.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(distinct action, ',' order by action), '(none)')
     from public.audit_log
    where action like '%created_on_registration' or action like '%recovered'),
  'affiliation.created_on_registration,org_affiliation.created_on_registration,org_affiliation.recovered',
  '4.8 ⭐ THE SPELLING PIN over the WHOLE trail, not over the ids this file happens to hold: exactly the three verbs ADR 0168 introduces, no more and no fewer. A suffix-matched sweep is what makes a near-miss visible — `org_affiliations.recovered`, say, would satisfy every entity-scoped cell above by simply never appearing in one, and would land in the trail as a verb no dashboard can see');

select * from finish();
rollback;
