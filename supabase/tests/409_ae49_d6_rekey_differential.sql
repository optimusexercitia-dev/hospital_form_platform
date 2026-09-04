-- 409 — AE4.9 (3/3): the THREE DIFFERENTIAL REPRESENTATIVES re-keyed to layer 3.
-- Subject: 20261003007300 (ADR 0176 D6 — the Gate AE4 minimum, PO-confirmed 2026-09-02).
--
-- ⛔⛔ WHAT THIS SUITE IS FOR, AND WHY A GREEN HERE IS NOT AUTOMATICALLY EVIDENCE.
--
-- 0176 D6's gate line is not "a permission check exists at the site". It is: **the grant-deletion
-- mutation flips the PRODUCTION DOOR, not the resolver**. Before 20261003007300, on this exact
-- seed at head 20261003007260, all three representatives measured:
--
--     grant present -> resolver t / door t        grant DELETED -> resolver f / door **t**
--
-- That is the F1 conformance defect: the approved matrix was the oracle of nothing observable.
-- So every ⭐ assertion below is a DIFFERENTIAL between those two worlds, asserted on BOTH
-- polarities — a one-directional mutation leaves the opposite polarity unproven, and a
-- `door = false` that was already false proves nothing about the grant.
--
-- ⚠ THREE WAYS THIS SUITE COULD HAVE BEEN VACUOUS, EACH CLOSED BY A NAMED CONTROL:
--
--  (a) THE PERMISSIVE SIBLING. Each form table carries a `*_select` policy gated on
--      `app.is_member_of`, and a staff_admin is a member. A SELECT-based row assertion therefore
--      stays GREEN with the write policy entirely revoked. §2 asserts on WRITES only, and §2.10
--      is the control that PROVES the sibling is open — so the write assertions are attributable.
--  (b) THE MASKING ARM. `can_read_professional_profile`'s case-committee arm grants with no org
--      term at all, and the ONE seeded `professional_profiles` row IS seated in a case this
--      suite's principal can read (measured: `can_read_case_committee` -> TRUE). Mutating the org
--      arm on that subject reads green-after-mutation for an unrelated reason. §4 builds a
--      participation-free subject and §4.0a/§4.0b assert the mask closed AND prove that
--      assertion can see the open case.
--  (c) THE EARLIER GUARD. `public.create_professional_profile` calls
--      `app.assert_case_participants_enabled()` BEFORE the authority check, raising
--      `check_violation`. §3.0 asserts the flag ON, and §3 keys every denial on `42501` — so a
--      flag failure can never be read as an authority failure.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` — same reason as 401 and 407: its subject
-- is the real seeded population, which bootstrap's `truncate … cascade` would destroy. Every
-- fixture row it creates is identified precisely, and the whole file rolls back regardless.
--
-- ⚠ THE RESOLVER IS NEVER CALLED UNDER `authenticated`. Application roles hold no USAGE on
-- `authz` (401 §18), so layer-2 probes run at the suite's default role and door probes run under
-- `set local role authenticated`. Deleting a grant likewise needs `reset role` first.
--
-- RUN SHAPE: `Files=2, Tests=73` (72 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a
-- count mismatch.
-- ⚠ 63 -> 72 at 20261003007340: § 2's mutated half now covers `form_item_options` and
-- `form_item_validations`, the two sites BUG-AE49-D6-REKEY-INCOMPLETE found un-re-keyed. Before
-- that migration §2 measured 4 of the 6 policy sites and its own caption called the result "the
-- production door".

begin;
select plan(72);

-- ============================================================================
-- §0 — FIXTURE + PRECONDITIONS. Every precondition is ASSERTED, never claimed: a reading is not
-- a fact until it is pinned to the state you are claiming about (authz-handoff §7.3), and this
-- stack is reset constantly.
-- ============================================================================

create temp table f409 on commit drop as
select
  (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')        as sa,   -- staff_admin @ CCIH
  (select p.id from public.profiles p where p.email = 'orgadmin.a@test.local')        as oa,   -- org_admin @ Rede A
  (select p.id from public.profiles p where p.email = 'hospitaladmin.a1@test.local')  as ha,   -- hospital_admin @ the hospital owning CCIH
  (select p.id from public.profiles p where p.email = 'platform@test.local')          as pa,   -- platform_admin
  (select p.id from public.profiles p where p.email = 'staff1.ccih@test.local')       as st,   -- plain staff @ CCIH
  (select p.id from public.profiles p where p.email = 'staff1.qual.b@test.local')     as xb;   -- staff_admin in the OTHER org

create temp table f409s on commit drop as
select
  (select m.commission_id from public.memberships m
    where m.principal_id = (select sa from f409) and m.role = 'staff_admin' limit 1)   as cid,
  (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
    where c.id = (select m.commission_id from public.memberships m
                   where m.principal_id = (select sa from f409) and m.role = 'staff_admin' limit 1)) as oid,
  (select f.id from public.forms f
    where f.commission_id = (select m.commission_id from public.memberships m
                              where m.principal_id = (select sa from f409) and m.role = 'staff_admin' limit 1)
    order by f.id limit 1)                                                             as fid,
  (select pp.id from public.professional_profiles pp limit 1)                          as seeded_prof;

-- The door probes below run under `set local role authenticated`, which cannot read a temp table
-- created by the suite's own role. (Same idiom as 100/110/252.)
grant select on f409  to authenticated;
grant select on f409s to authenticated;

select is((select count(*)::int from (
            select sa as u from f409 union all select oa from f409 union all select ha from f409
            union all select pa from f409 union all select st from f409 union all select xb from f409) t
          where t.u is not null), 6,
  '0.1 FIXTURE CONTROL: all six persona ids resolved. ⛔ A NULL uid denies for the wrong reason '
  'and asserts nothing (authz-handoff §7.2 case 4 — a plausible name is not a role).');

select is((select state::text from authz.roles where code = 'staff_admin'), 'authoritative',
  '0.2 PRECONDITION: `staff_admin` is `authoritative`. Layer 2 fails closed for any other state '
  '(0177 D1), so if this were false every ⭐ mutation below would flip for the STATE, not the '
  'GRANT, and the whole suite would be measuring the wrong axis.');

select is((select count(*)::int from authz.roles
            where code in ('org_admin','hospital_admin','platform_admin') and state::text = 'legacy'), 3,
  '0.3 PRECONDITION: the three tenancy/admin roles are ALL still `legacy`, so their '
  '`authz.role_permissions` rows are INERT (0177 D6). This is exactly WHY their arms had to be '
  'preserved verbatim rather than re-keyed — and it is what makes the legacy-equivalence '
  'assertions below meaningful rather than tautological.');

select is((select count(*)::int from authz.role_permissions
            where permission_code in ('commission.forms.edit','org.professionals.create','org.professionals.read')), 3,
  '0.4 PRECONDITION: exactly THREE grant rows carry the three codes — one each, all to '
  '`staff_admin`. ⛔ A second granting role would make a single-row delete a no-op and every '
  '⭐ mutation below would report "no flip" as a defect in the re-key.');

select is((select count(*)::int from authz.permission_implication_closure
            where implied in ('commission.forms.edit','org.professionals.create','org.professionals.read')), 3,
  '0.5 PRECONDITION: the implication closure over the three codes is REFLEXIVE-ONLY (3 rows, '
  'each code implying itself). If some other code implied one of these, deleting the direct '
  'grant would leave the entitlement standing and the ⭐ mutations would be unable to flip.');

select ok(app.feature_enabled('case_participants'),
  '0.6 PRECONDITION for §3: the `case_participants` flag is ON. '
  '`public.create_professional_profile` calls `assert_case_participants_enabled()` BEFORE the '
  'authority check and raises `check_violation`; §3 keys on `42501`, so an earlier guard firing '
  'can never be mistaken for the authority gate it stands in front of.');

-- ============================================================================
-- §1 — D7 "STATICALLY GREPPABLE". The permission code must be a literal AT the enforcement site.
-- Baseline measured before 20261003007300: ZERO functions in `app`+`public` carried ANY of the
-- 43 codes. This section pins the seam's existence as a falsifiable fact.
-- ============================================================================

create or replace function pg_temp.code_sites() returns table(site text, code text)
language sql stable as $$
  with b as (select n.nspname, p.proname,
                    regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') as src
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('app','public'))
  select b.nspname || '.' || b.proname, pm.code
    from b join authz.permissions pm on b.src like '%' || pm.code || '%';
$$;

-- ⛔ `order by code, site` — NOT `order by code` alone, which is what this was until
--    20261003007320 made `org.professionals.read` a TWO-SITE code. With two rows sharing a
--    sort key the aggregate's order was unspecified, so the assertion would have passed or
--    failed on whatever order the executor happened to produce. A pin that can flip without
--    the subject changing is worse than no pin.
select is((select string_agg(site || ' => ' || code, ' | ' order by code, site) from pg_temp.code_sites()),
  'app.can_edit_commission_forms => commission.forms.edit | '
  'app.can_create_professional => org.professionals.create | '
  'app.can_read_professional_profile => org.professionals.read | '
  'app.current_professional_read_organizations => org.professionals.read',
  '1.1 ⭐ THE SEAM, AS A NAMED SET RATHER THAN A COUNT: exactly FOUR (site, code) pairs exist '
  'across `app` + `public`. ⛔ A count would pass on a swap; this reds if a code moves, is '
  'duplicated, or lands at the wrong gate. '
  '⚠ The probe strips `--` comments first — a prosrc text match otherwise counts comments '
  '(authz-handoff §7.2 case 2). '
  '⭐ 3 -> 4 at AE4/IA-F9 (20261003007320, ADR 0182), and the added pair is a DELIBERATE '
  'SECOND SITE for org.professionals.read, ruled rather than absorbed: this section previously '
  'read "each code at exactly one site", which was a description of the D6 state and not a '
  'requirement D7 imposes. D7 asks that the code be a LITERAL AT the enforcement site, and the '
  'new site satisfies that. WHY THE DUPLICATION IS SAFE, and it is a subset argument rather '
  'than an assurance: app.current_professional_read_organizations cannot grant anything '
  'app.can_read_professional_profile would not, because every scope id it returns has been '
  'reconfirmed by authz.has_permission itself before being returned, and the policy consults '
  'it as the THEN arm of a CASE whose ELSE is the original authorizer. Pinned as an invariant '
  'by 413 §5 (SUBSET) and measured on both polarities by 413 §2. ⛔ A THIRD site for this code '
  'is NOT covered by that reasoning — re-rule it, do not extend the string.');

select is((select count(*)::int from pg_temp.code_sites() where code = 'org.professionals.manage'), 0,
  '1.2 DISCRIMINATION CONTROL for 1.1: the SAME probe returns ZERO for a code that is NOT '
  'and must NOT be re-keyed (`org.professionals.manage`, the code AE4.7c revoked from '
  'staff_admin). So 1.1''s three hits are observations, not a `like` pattern that matches '
  'everything — the probe returns both answers.');

select is((select count(*)::int from authz.permissions
            where code not in (select code from pg_temp.code_sites())), 40,
  '1.3 THE COUNTDOWN, PINNED: 40 of the 43 permissions carry NO enforcement-site literal — they '
  'are the `pending-rekey` population (0176 D5/D6). ⛔ This number is meant to FALL, one AE5 role '
  'increment at a time. It is asserted here so that "N of 43 re-keyed" is a measured figure and '
  'not a sentence in a gate record.');

select is((select count(*)::int from pg_policies
            where coalesce(qual,'') || coalesce(with_check,'') ~ '\yauthz\.'), 0,
  '1.4 ⭐ NO POLICY CALLS LAYER 1 OR LAYER 2 DIRECTLY. 0176 D2: "A policy or door that calls '
  'layer 1 or 2 directly for a permission decision is a finding." Policies reach `authz` only '
  'through an `app.*` wrapper or authorizer — which is also why the `authz` schema can stay '
  'sealed from application roles (401 §18).');

-- ============================================================================
-- §2 — REPRESENTATIVE 1: `commission.forms.edit`.
-- Production door = the SIX FOR ALL write policies on forms / form_versions / form_sections /
-- form_items / form_item_options / form_item_validations. Both halves matter: `USING` gates WHICH
-- ROWS may be touched, `WITH CHECK` gates the NEW row, and a gate present in only one half is a
-- real hole.
--
-- ⛔⛔ SIX, NOT FOUR — AND THE FOUR WAS THIS SECTION'S OWN BLIND SPOT. 20261003007300 re-pointed
-- four policies; `form_item_options_staff_admin_write` and `form_item_validations_staff_admin_write`
-- kept the pre-cutover predicate verbatim, and this section asserted `= 4` over a tablename list
-- that did not name them. A count over a hand-written domain cannot see outside its own domain:
-- the assertion was TRUE and the sentence it supported — "the grant-deletion mutation flips the
-- production door" — was 4/6. Filed as BUG-AE49-D6-REKEY-INCOMPLETE, fixed by 20261003007340,
-- and the structural gap that let it through is closed on the manifest side by 410 § 8 (site-axis
-- closure, both directions), which is what will catch the NEXT one rather than this list.
-- ⚠ The seventh name in matrix row 1, `form_block_library`, is NOT a policy site at all — it has
-- no write policy and every write goes through a SECURITY DEFINER door. See 20261003007340's
-- header; correcting the matrix is review finding F-REC-4.
-- ============================================================================

select is((select count(*)::int from pg_policies
            where tablename in ('forms','form_versions','form_sections','form_items',
                                'form_item_options','form_item_validations')
              and policyname like '%_staff_admin_write'
              and coalesce(qual,'')       ~ 'can_edit_commission_forms'
              and coalesce(with_check,'') ~ 'can_edit_commission_forms'
              and coalesce(qual,'')       !~ 'is_staff_admin_of'
              and coalesce(with_check,'') !~ 'is_staff_admin_of'), 6,
  '2.1 STRUCTURAL: all SIX write policies call the layer-3 authorizer in BOTH halves and neither '
  'half still calls the layer-1 wrapper. ⚠ This is a bound on the behavioural probes below, which '
  'exercise `forms` (direct commission_id), `form_versions` (the forms-subquery cid), '
  '`form_sections`, `form_item_options` and `form_item_validations` (the '
  '`commission_of_version` cid) — `form_items` shares that expression verbatim and is covered '
  'behaviourally only as the fixture for 2.6b/2.6d. ⛔ THE TABLENAME LIST IS THE DOMAIN OF THIS '
  'ASSERTION AND IT IS HAND-WRITTEN: adding a seventh policy without adding its table here keeps '
  'this green. 410 § 8.4 is the arm that reads the domain from the CATALOG instead; do not treat '
  'this count as closure.');

select ok((select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_edit_commission_forms')
          ~ 'authz\.has_permission'
      and (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_edit_commission_forms')
          ~ 'is_tenancy_admin_of_for',
  '2.2 STRUCTURAL: the authorizer composes BOTH arms — the catalog permission AND the preserved '
  'tenancy arm. ⛔ Dropping the second is the regression this whole increment is shaped around, '
  'and it would be invisible to a staff_admin-keyed differential.');

-- ---------- BASELINE: the grant is present ----------
select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;

with u as (update public.forms set title = title
            where id = (select fid from f409s) returning 1)
select is((select count(*)::int from u),1,
  '2.3 BASELINE, USING half: the staff_admin''s UPDATE reaches the row.');

select lives_ok($$ insert into public.forms (commission_id, title)
                   values ((select cid from f409s), '409 baseline form') $$,
  '2.4 BASELINE, WITH CHECK half: the staff_admin may create a form in her commission.');

select lives_ok($$ insert into public.form_versions (form_id, version_number, status)
                   values ((select fid from f409s), 9091, 'draft') $$,
  '2.5 BASELINE, WITH CHECK half through the FORMS SUBQUERY cid (form_versions'' own policy '
  'derives the commission through `(select f.commission_id from forms f where f.id = form_id)`).');

select lives_ok($$ insert into public.form_sections (form_version_id, position, title)
                   values ((select id from public.form_versions where form_id = (select fid from f409s)
                             and version_number = 9091), 1, '409 baseline section') $$,
  '2.6 BASELINE, WITH CHECK half through `app.commission_of_version(form_version_id)` — the '
  'deepest of the four cid derivations, shared verbatim with form_items.');

-- ⚠ THE TWO ITEMS BELOW ARE FIXTURE **AND** ASSERTION. They must land for 2.6b/2.6d to have a
-- parent, and they are also the only behavioural exercise of `form_items_staff_admin_write`.
-- ⛔ THEY ARE CREATED IN THE **DRAFT** VERSION 9091 ON PURPOSE. `guard_published_structure` fires
-- on form_items / form_item_options / form_item_validations and raises BEFORE RLS is ever
-- consulted; an item borrowed from a PUBLISHED seeded version would make every probe below fail
-- for Architecture Rule 5 rather than for authority — "an earlier guard firing leaves the LATER
-- one untested". The item TYPES are equally deliberate: `app.validation_rule_allowed` permits
-- `text_length` only on short_text/free_text, and options only attach to a choice item
-- (`form_item_options_parent_is_choice_trg`).
select lives_ok($$ insert into public.form_items
                     (form_version_id, section_id, position, item_type, question_key, label)
                   values
                     ((select id from public.form_versions
                        where form_id = (select fid from f409s) and version_number = 9091),
                      (select id from public.form_sections
                        where form_version_id = (select id from public.form_versions
                                                  where form_id = (select fid from f409s)
                                                    and version_number = 9091)
                          and position = 1),
                      1, 'multiple_choice', 'q409mc', '409 choice'),
                     ((select id from public.form_versions
                        where form_id = (select fid from f409s) and version_number = 9091),
                      (select id from public.form_sections
                        where form_version_id = (select id from public.form_versions
                                                  where form_id = (select fid from f409s)
                                                    and version_number = 9091)
                          and position = 1),
                      2, 'short_text', 'q409st', '409 short text') $$,
  '2.6a BASELINE, WITH CHECK half on `form_items` — the fourth site of 20261003007300, and the '
  'parent fixture for the two sites 20261003007340 adds.');

select lives_ok($$ insert into public.form_item_options
                     (form_version_id, item_id, position, code, label)
                   values ((select id from public.form_versions
                             where form_id = (select fid from f409s) and version_number = 9091),
                           (select id from public.form_items
                             where form_version_id = (select id from public.form_versions
                                                       where form_id = (select fid from f409s)
                                                         and version_number = 9091)
                               and question_key = 'q409mc'),
                           1, 'sim', 'Sim') $$,
  '2.6b ⭐ BASELINE, WITH CHECK half on `form_item_options` — SITE 5, re-keyed by 20261003007340. '
  'Before that migration this policy read `app.is_staff_admin_of(...) OR '
  'app.is_tenancy_admin_of(...)` verbatim and 2.10a below reported the row INSERTED under the '
  'mutation.');

with u as (update public.form_item_options set label = label
            where item_id = (select id from public.form_items
                              where form_version_id = (select id from public.form_versions
                                                        where form_id = (select fid from f409s)
                                                          and version_number = 9091)
                                and question_key = 'q409mc') returning 1)
select is((select count(*)::int from u), 1,
  '2.6c ⭐ BASELINE, USING half on `form_item_options`. ⛔ Asserted separately from 2.6b because '
  '`USING` and `WITH CHECK` answer different questions, and 20261003007340 rewrote BOTH halves of '
  'this policy — a fix applied to one half only would pass 2.6b/2.10a and leave a real hole.');

-- ⛔⛔ SITE 6 HAS NO BEHAVIOURAL PROBE, AND THE REASON IS ASSERTED RATHER THAN LEFT AS A GAP.
-- The first draft of this section DID probe `form_item_validations` with `lives_ok`/`throws_ok`
-- exactly like the sibling table. It died: `42501: permission denied for table
-- form_item_validations`, raised by the GRANT layer before RLS was ever consulted. `authenticated`
-- holds SELECT and nothing else there, so `form_item_validations_staff_admin_write` is a BACKSTOP
-- that no `authenticated` statement can reach — "a correct door nothing can reach". ⛔ The
-- mutated twin of that draft PASSED, for the wrong reason: `throws_ok(..., '42501')` cannot tell a
-- missing INSERT grant from a closed policy, so it would have reported the gate flipping while
-- measuring a privilege that never moved. That is why the pair below asserts the GRANT POSTURE
-- instead, on both polarities.
select is(
  (select string_agg(privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'form_item_validations'
      and grantee = 'authenticated'),
  'SELECT',
  '2.6d ⭐⭐ SITE 6 IS A BACKSTOP, NOT A REACHABLE DOOR: `authenticated` holds SELECT ONLY on '
  '`form_item_validations`. Its writes go through `public.set_item_validations` (SECURITY '
  'DEFINER), so re-keying its policy at 20261003007340 is CONFORMANCE and could not widen '
  'anything — there is no grant for a policy to permit. ⛔ IF THIS REDS BECAUSE A DML GRANT WAS '
  'ADDED, the site becomes live and needs the behavioural pair 2.6b/2.6c/2.10a/2.10b has; do not '
  'update the expected string without adding them.');

select is(
  (select string_agg(privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'form_item_options'
      and grantee = 'authenticated' and privilege_type in ('INSERT','SELECT','UPDATE','DELETE')),
  'DELETE,INSERT,SELECT,UPDATE',
  '2.6e DISCRIMINATION HALF of 2.6d, and it is what makes 2.6d an observation rather than a '
  'dead query: the SIBLING table re-keyed by the same migration DOES carry full DML for '
  '`authenticated`. So the two sites 20261003007340 touches have OPPOSITE reachability, the '
  'probe distinguishes them, and 2.6b/2.10a are known to be exercising a live door.');

reset role;

-- ---------- ⭐ THE MUTATION ----------
delete from authz.role_permissions
 where role_code = 'staff_admin' and permission_code = 'commission.forms.edit';

select is((select count(*)::int from authz.role_permissions
            where role_code = 'staff_admin' and permission_code = 'commission.forms.edit'), 0,
  '2.7 THE MUTATION LANDED. ⛔ Asserted, not assumed: a mutation that did not fully apply reports '
  'GREEN, and every ⭐ below would then be measuring the unmutated world.');

select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;

with u as (update public.forms set title = title
            where id = (select fid from f409s) returning 1)
select is((select count(*)::int from u),0,
  '2.8 ⭐⭐ THE GATE LINE, USING half: with the single grant row deleted, the staff_admin''s '
  'UPDATE reaches NOTHING. Before 20261003007300 this read 1 while the resolver read false — '
  'that gap IS audit finding F1. Differential against 2.3: exactly one fact changed.');

select throws_ok($$ insert into public.forms (commission_id, title)
                    values ((select cid from f409s), '409 mutated form') $$, '42501', null,
  '2.9 ⭐⭐ THE GATE LINE, WITH CHECK half: the same deletion also blocks the NEW row. '
  '⛔ `USING` and `WITH CHECK` answer different questions and a gate present in only one is a '
  'real hole, so both halves are mutated separately. Differential against 2.4.');

select throws_ok($$ insert into public.form_sections (form_version_id, position, title)
                    values ((select id from public.form_versions where form_id = (select fid from f409s)
                              and version_number = 9091), 2, '409 mutated section') $$, '42501', null,
  '2.10 ⭐ ...and through the derived-cid path too, so the flip is a property of the authorizer '
  'and not of one hand-written policy expression. Differential against 2.6.');

select throws_ok($$ insert into public.form_item_options
                      (form_version_id, item_id, position, code, label)
                    values ((select id from public.form_versions
                              where form_id = (select fid from f409s) and version_number = 9091),
                            (select id from public.form_items
                              where form_version_id = (select id from public.form_versions
                                                        where form_id = (select fid from f409s)
                                                          and version_number = 9091)
                                and question_key = 'q409mc'),
                            2, 'nao', 'Não') $$, '42501', null,
  '2.10a ⭐⭐ THE GATE LINE AT SITE 5, WITH CHECK half. Differential against 2.6b. ⛔ THIS IS THE '
  'ASSERTION BUG-AE49-D6-REKEY-INCOMPLETE WOULD HAVE FAILED: at head 20261003007330 this policy '
  'still called `app.is_staff_admin_of`, so deleting the `staff_admin -> commission.forms.edit` '
  'grant left the INSERT succeeding while §2.8/§2.9 reported the door shut. ⚠ Keyed on `42501` '
  'specifically — `guard_published_structure` and `form_item_options_parent_is_choice_trg` both '
  'raise on this table with different SQLSTATEs, and a bare `throws_ok` would read either as the '
  'authority gate.');

with u as (update public.form_item_options set label = label
            where item_id = (select id from public.form_items
                              where form_version_id = (select id from public.form_versions
                                                        where form_id = (select fid from f409s)
                                                          and version_number = 9091)
                                and question_key = 'q409mc') returning 1)
select is((select count(*)::int from u), 0,
  '2.10b ⭐⭐ THE GATE LINE AT SITE 5, USING half: the row 2.6c updated is now unreachable. '
  'Differential against 2.6c — exactly one fact changed between them, and it is a row in '
  '`authz.role_permissions`.');

select is(
  (select case when regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
                    ~ 'app\.is_staff_admin_of\(' then 'layer1' else 'moved' end
          || '/' ||
          case when position('''commission.forms.edit''' in
                             regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')) > 0
               then 'carries-the-code' else 'no-code' end
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_item_validations'),
  'layer1/no-code',
  '2.10c ⭐⭐ THE DISCLOSED LIMIT OF REPRESENTATIVE 1, PINNED SO IT CANNOT BE READ AS DONE. '
  '`public.set_item_validations` is the ONLY `authenticated`-reachable write path to '
  '`form_item_validations` (2.6d), and it still gates on `app.is_staff_admin_of(...) OR '
  'app.is_tenancy_admin_of(...)` and carries NO permission-code literal. So deleting the '
  '`staff_admin -> commission.forms.edit` grant does NOT stop a staff_admin editing validations '
  '— the POLICY door flips (that is what 20261003007340 achieved and what 2.1 asserts), the '
  'DEFINER door does not. ⛔ THIS PINS A KNOWN STATE, NOT A DEFECT TO PRESERVE: matrix row 1''s '
  '"D 8 form fns" are 0-of-8 re-keyed (measured: exactly FOUR permission-code literals exist in '
  '`app`+`public` at this head, all of them authorizers), and moving them is AE5 work. WHEN AE5 '
  'RE-KEYS THIS DOOR THIS ASSERTION REDS, and the fix is to change the expected string to '
  '`moved/carries-the-code` and add the behavioural differential — never to delete the line. '
  '⚠ THE NEEDLE IS THE CODE AS A STRING LITERAL, WITH ITS QUOTES, AND `position` RATHER THAN A '
  'REGEX — permission codes contain `.`, which a regex reads as "any character". ⛔ It names the '
  'ONE code rather than joining `authz.permissions`: this probe runs under `set local role '
  'authenticated`, which holds NO USAGE on `authz` (see this file''s header). The first draft '
  'joined that table and died with `permission denied for schema authz` mid-section. '
  '⚠ Without this pin, §2''s green reads as "the production door for commission.forms.edit '
  'flips", which is true of the six policies and false of the eight doors.');

select cmp_ok((select count(*)::int from public.form_item_options
                where item_id = (select id from public.form_items
                                  where form_version_id = (select id from public.form_versions
                                                            where form_id = (select fid from f409s)
                                                              and version_number = 9091)
                                    and question_key = 'q409mc')), '=', 1,
  '2.10d ⭐ THE PERMISSIVE-SIBLING CONTROL FOR SITES 5 AND 6, the same trap 2.11 documents for '
  '`forms`. Under the SAME mutation the staff_admin can still SELECT the option row through '
  '`form_item_options_select` (gated on `app.is_member_of`), so 2.10a/2.10b measured the WRITE '
  'gate closing and not the row vanishing. ⛔ Exactly ONE row: 2.6b''s. 2.10a''s insert was '
  'rejected, so a count of 2 here would mean 2.10a''s throws_ok caught a rollback of something '
  'that had already been written.');

select cmp_ok((select count(*)::int from public.forms where id = (select fid from f409s)), '>=', 1,
  '2.11 ⭐⭐ THE PERMISSIVE-SIBLING CONTROL, AND IT IS WHAT MAKES §2 EVIDENCE. Under the SAME '
  'mutation the staff_admin can still SELECT the form — because `forms_select` is a separate '
  'PERMISSIVE policy gated on `app.is_member_of`. ⛔ So a SELECT-based row assertion would have '
  'stayed GREEN with the write policy entirely revoked (authz-handoff §7.1 shape 6). This '
  'assertion exists to prove that trap was live and was avoided, not to prove reads work.');

reset role;

-- ---------- LEGACY EQUIVALENCE, measured UNDER the mutation ----------
select test_helpers.claims_for((select oa from f409), false, 'org_admin'); set local role authenticated;
with u as (update public.forms set title = title
            where id = (select fid from f409s) returning 1)
select is((select count(*)::int from u),1,
  '2.12 ⭐ LEGACY EQUIVALENCE, USING half: with the `staff_admin` grant still DELETED, the '
  'ORG_ADMIN''s UPDATE still reaches the row. `org_admin` is `legacy`, its catalog grants are '
  'inert and layer 2 fails closed for it — so this passes ONLY because the tenancy arm was '
  'preserved verbatim. A naive one-line substitution reds here.');
select lives_ok($$ insert into public.forms (commission_id, title)
                   values ((select cid from f409s), '409 org_admin form') $$,
  '2.13 ⭐ LEGACY EQUIVALENCE, WITH CHECK half, same principal, same mutation.');
reset role;

select test_helpers.claims_for((select ha from f409), false, 'hospital_admin'); set local role authenticated;
with u as (update public.forms set title = title
            where id = (select fid from f409s) returning 1)
select is((select count(*)::int from u),1,
  '2.14 ⭐ LEGACY EQUIVALENCE, second preserved principal: the HOSPITAL_ADMIN of the hospital '
  'that owns this commission still reaches the row under the same mutation. The tenancy arm has '
  'TWO disjuncts and one surviving disjunct would satisfy an org_admin-only assertion.');
select lives_ok($$ insert into public.forms (commission_id, title)
                   values ((select cid from f409s), '409 hospital_admin form') $$,
  '2.15 ⭐ LEGACY EQUIVALENCE, WITH CHECK half, hospital_admin.');
reset role;

-- ---------- RESTORE, PROVEN ----------
insert into authz.role_permissions (role_code, permission_code)
  values ('staff_admin', 'commission.forms.edit');

select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
with u as (update public.forms set title = title
            where id = (select fid from f409s) returning 1)
select is((select count(*)::int from u),1,
  '2.16 THE RESTORE IS PROVEN, not assumed: re-inserting the one grant row brings the door back. '
  '⛔ A mutation harness that cannot show its rollback landed has measured nothing — the probe '
  'must MOVE the answer and the restore must bring it BACK.');
reset role;

-- ---------- NEGATIVE CONTROL, with the grant PRESENT ----------
select test_helpers.claims_for((select st from f409), false, 'staff'); set local role authenticated;
with u as (update public.forms set title = title
            where id = (select fid from f409s) returning 1)
select is((select count(*)::int from u),0,
  '2.17 NEGATIVE CONTROL: a plain `staff` of the SAME commission reaches nothing even with the '
  'grant restored — denied for a reason that is not the mutation (she never held the code and is '
  'no tenancy admin). ⛔ Without this, 2.8''s zero could be "this principal can never write".');
select cmp_ok((select count(*)::int from public.forms where id = (select fid from f409s)), '>=', 1,
  '2.18 DISCRIMINATION half of 2.17: the same `staff` CAN still see the row through '
  '`forms_select`. So 2.17''s zero is the WRITE gate closing, not the row being invisible to '
  'her — a dead instrument would satisfy both an "is empty" check and its own control.');
reset role;

-- ============================================================================
-- §3 — REPRESENTATIVE 2: `org.professionals.create`.
-- Production door = `public.create_professional_profile` (42501). `app.can_create_professional`
-- itself is NOT EXECUTE-granted to `authenticated`, so the RPC is the reachable enforcement site.
-- ============================================================================

select ok((select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_create_professional')
          ~ 'can_manage_professional'
      and (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_create_professional')
          !~ 'is_org_commission_staff_admin',
  '3.1 STRUCTURAL: the org-authority arm is preserved and the `is_org_commission_staff_admin` '
  'ascent is GONE — replaced, not OR-ed alongside. ⛔ `legacy OR new` for the same population is '
  'forbidden (0155 D7 / 0176 Consequences): it would leave the door answering the old way while '
  'the catalog looked load-bearing.');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app'
              and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'is_org_commission_staff_admin'
              and p.proname <> 'is_org_commission_staff_admin'), 2,
  '3.2 ...and the helper SURVIVES with exactly its two other callers '
  '(`can_manage_external_participant`, `can_manage_case_vocabulary` — catalog rows 31 and 32, '
  'still `pending-rekey`). ⛔ Cutting them collaterally would have been a silent narrowing of two '
  'permissions nobody asked this increment to touch.');

select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select lives_ok($$ select public.create_professional_profile((select oid from f409s), '409 Baseline Prof') $$,
  '3.3 BASELINE: the staff_admin may register a professional in her organization (the '
  'commission -> organization scope ascent, which `authz.scope_reaches` computes).');
reset role;

delete from authz.role_permissions
 where role_code = 'staff_admin' and permission_code = 'org.professionals.create';
select is((select count(*)::int from authz.role_permissions
            where role_code = 'staff_admin' and permission_code = 'org.professionals.create'), 0,
  '3.4 THE MUTATION LANDED (asserted, not assumed).');

select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select throws_ok($$ select public.create_professional_profile((select oid from f409s), '409 Mutated Prof') $$,
  '42501', null,
  '3.5 ⭐⭐ THE GATE LINE: the deleted grant closes the PRODUCTION DOOR — the RPC now raises the '
  'AUTHORITY error. Before 20261003007300 it returned a uuid while the resolver read false. '
  '⛔ The errcode is load-bearing: `42501` is the authority raise, `check_violation` would be the '
  'feature-flag guard standing in front of it (§0.6). Differential against 3.3.');
reset role;

select test_helpers.claims_for((select oa from f409), false, 'org_admin'); set local role authenticated;
select lives_ok($$ select public.create_professional_profile((select oid from f409s), '409 OrgAdmin Prof') $$,
  '3.6 ⭐ LEGACY EQUIVALENCE: the ORG_ADMIN still registers professionals with the `staff_admin` '
  'grant deleted — the `can_manage_professional` arm was preserved verbatim. `org_admin` is '
  '`legacy`, so layer 2 grants it nothing; only the preserved arm can be why this passes.');
reset role;

select test_helpers.claims_for((select pa from f409), true, 'platform_admin'); set local role authenticated;
select lives_ok($$ select public.create_professional_profile((select oid from f409s), '409 Platform Prof') $$,
  '3.7 ⭐ LEGACY EQUIVALENCE, second preserved principal: the PLATFORM_ADMIN arm (`app.is_admin()`, '
  'which also requires the platform_admin hat) still passes under the same mutation. Professional '
  'IDENTITY is inside platform_admin''s noun (ADR 0078 A35); commission CONTENT is not, which is '
  'why §2 has no platform_admin twin — `is_tenancy_admin_of` carries no such arm and must not.');
reset role;

select test_helpers.claims_for((select st from f409), false, 'staff'); set local role authenticated;
select throws_ok($$ select public.create_professional_profile((select oid from f409s), '409 Staff Prof') $$,
  '42501', null,
  '3.8 NEGATIVE CONTROL, measured while the grant is still deleted for everyone: a plain `staff` '
  'is refused too. Paired with 3.6/3.7 this shows the door returns BOTH answers in the mutated '
  'world, so 3.5''s denial is the gate and not a stuck raise.');
reset role;

insert into authz.role_permissions (role_code, permission_code)
  values ('staff_admin', 'org.professionals.create');
select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select lives_ok($$ select public.create_professional_profile((select oid from f409s), '409 Restored Prof') $$,
  '3.9 THE RESTORE IS PROVEN: re-inserting the grant reopens the door.');
reset role;

-- ---------- BUG-PROF-INACTIVE-001's INVARIANT, RE-ANCHORED ON BEHAVIOUR ----------
-- ⛔ WHY THIS ASSERTION EXISTS AND WHY IT IS HERE. pgTAP `404` §1.6 asserts the `is_active` chain
-- STRUCTURALLY — that `can_create_professional`'s body still names `is_org_commission_staff_admin`,
-- which is where the gate used to live. This migration removes that disjunct, so `404` §1.6 RED s.
-- The INVARIANT it protects has NOT gone: `authz.assignment_facts` applies `app.is_active` to the
-- principal before any assignment is projected, so the gate now arrives through layer 1 instead.
-- ⚠ That is a claim about a MECHANISM, and a mechanism is measured, not read off the body it moved
-- out of — so it is measured here. If this ever reds, an inactive professional-registrar can
-- create professionals and `404`'s structural proxy would not have told you.
select test_helpers.reset_role_and_claims();
update public.profiles set is_active = false where id = (select sa from f409);
select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select throws_ok($$ select public.create_professional_profile((select oid from f409s), '409 Inactive Prof') $$,
  '42501', null,
  '3.10 ⭐ BUG-PROF-INACTIVE-001 SURVIVES THE RE-KEY: a DEACTIVATED staff_admin is still refused, '
  'with the grant present and nothing else changed against 3.9. The `is_active` gate moved from '
  '`is_org_commission_staff_admin` (removed here) into `authz.assignment_facts` (layer 1), and '
  'this is the behavioural proof that it moved rather than vanished.');
-- ⛔ CLAIMS, not just the ROLE. `guard_profile_privileged_columns` waves through a caller with a
-- NULL `auth.uid()` and refuses a signed-in non-admin — so a bare `reset role` leaves the previous
-- persona's claims standing and the write is refused. Same lesson as 403's cleanup note, one layer
-- out; it cost a red here before it was applied.
select test_helpers.reset_role_and_claims();
update public.profiles set is_active = true where id = (select sa from f409);
select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select lives_ok($$ select public.create_professional_profile((select oid from f409s), '409 Reactivated Prof') $$,
  '3.11 ...and REACTIVATING reopens it, so 3.10''s denial is attributable to `is_active` and not '
  'to some residue of the mutation block above. Both polarities, one fact changed.');
reset role;

-- ============================================================================
-- §4 — REPRESENTATIVE 3: `org.professionals.read`.
-- Production door = the RLS SELECT policy on `public.professional_profiles`.
-- ============================================================================

select is((select count(*)::int from pg_policies where tablename = 'professional_profiles'), 1,
  '4.1 SOLE-POLICY CONTROL, and it is what licenses a ROW-COUNT assertion here: '
  '`professional_profiles` carries exactly ONE policy. Postgres ORs permissive policies together, '
  'so a positive row assertion proves nothing about the predicate under test unless that '
  'predicate is the only grant of the row. Here it is — unlike §2''s tables, which is why §2 '
  'asserts on writes and §4 may assert on reads.');

select ok((select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_professional_profile')
          ~ 'can_read_case_committee'
      and (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_professional_profile')
          ~ 'is_admin'
      and (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_professional_profile')
          !~ 'can_create_professional',
  '4.2 STRUCTURAL: both untouched arms survive (`is_admin`, the case-committee traversal) and the '
  'org arm no longer delegates to row 43''s gate. ⛔ That delegation is why this site had to carry '
  'its OWN code: had it kept calling `can_create_professional`, deleting the `org.professionals.read` '
  'grant would not have moved it and §4.5 would have been measuring row 43 (401 §19.3).');

-- A participation-free subject, because arm 3 masks arm 2 for the seeded one.
insert into public.professional_profiles (id, organization_id, full_name)
  values ('fb000000-0000-0000-0000-00000000f409', (select oid from f409s), '409 Sujeito Sem Participacao');

select is((select count(*)::int from public.professional_participants
            where professional_profile_id = 'fb000000-0000-0000-0000-00000000f409'), 0,
  '4.3 ⭐ THE MASK IS CLOSED for this subject: it has no `professional_participants` row, so the '
  'case-committee arm cannot grant it and §4.5''s flip is attributable to the org arm alone. '
  '⛔ A mutation''s effect can be MASKED by a legitimately-open arm, and that is not hypothetical '
  'here — see 4.4.');

select ok(app.can_read_case_committee(
            (select cp.case_id from public.professional_participants pp
               join public.case_participants cp on cp.participant_id = pp.participant_id
              where pp.professional_profile_id = (select seeded_prof from f409s)
                and cp.removed_at is null limit 1),
            (select sa from f409)),
  '4.4 ⭐⭐ DISCRIMINATION CONTROL for 4.3, and the reason 4.3 is not decoration: the ONE seeded '
  'professional IS seated in a case this same principal can read. So the masking arm is genuinely '
  'OPEN in this fixture and 4.3''s zero is an observation, not a stuck predicate. ⚠ 403 §7.3''s '
  '"arm 3 cannot grant in this fixture" is true of 403''s OWN fixture, never of the seed.');

select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select is((select count(*)::int from public.professional_profiles
            where id = 'fb000000-0000-0000-0000-00000000f409'), 1,
  '4.5 BASELINE: the staff_admin reads the participation-free professional through the org arm.');
reset role;

delete from authz.role_permissions
 where role_code = 'staff_admin' and permission_code = 'org.professionals.read';
select is((select count(*)::int from authz.role_permissions
            where role_code = 'staff_admin' and permission_code = 'org.professionals.read'), 0,
  '4.6 THE MUTATION LANDED (asserted, not assumed).');

select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select is((select count(*)::int from public.professional_profiles
            where id = 'fb000000-0000-0000-0000-00000000f409'), 0,
  '4.7 ⭐⭐ THE GATE LINE: the deleted grant closes the PRODUCTION DOOR — the RLS policy now '
  'returns no row. Before 20261003007300 this read 1 while the resolver read false. Differential '
  'against 4.5, one fact changed.');

select is((select count(*)::int from public.professional_profiles
            where id = (select seeded_prof from f409s)), 1,
  '4.8 ⭐ ARM 3 SURVIVED THE RE-KEY, and this is the assertion that proves 4.7 cut the RIGHT arm: '
  'under the SAME mutation the SEEDED professional — the one seated in a readable case — is '
  'still visible. A re-key that had flattened the traversal arm would read 0 here and 4.7 would '
  'have looked identically green.');
reset role;

select test_helpers.claims_for((select oa from f409), false, 'org_admin'); set local role authenticated;
select is((select count(*)::int from public.professional_profiles
            where id = 'fb000000-0000-0000-0000-00000000f409'), 1,
  '4.9 ⭐ LEGACY EQUIVALENCE: the ORG_ADMIN still reads it with the grant deleted — the preserved '
  '`can_manage_professional` half of the org arm.');
reset role;

select test_helpers.claims_for((select pa from f409), true, 'platform_admin'); set local role authenticated;
select is((select count(*)::int from public.professional_profiles
            where id = 'fb000000-0000-0000-0000-00000000f409'), 1,
  '4.10 ⭐ LEGACY EQUIVALENCE: the PLATFORM_ADMIN arm (`is_admin()`, hat required) still reads it '
  'under the same mutation.');
reset role;

select test_helpers.claims_for((select xb from f409), false, 'staff_admin'); set local role authenticated;
select is((select count(*)::int from public.professional_profiles
            where id = 'fb000000-0000-0000-0000-00000000f409'), 0,
  '4.11 NEGATIVE CONTROL, cross-tenant: a staff_admin in the OTHER organization reads nothing. '
  '⚠ Measured while the grant is deleted, so it is not yet discriminating on its own — 4.12 is.');
reset role;

insert into authz.role_permissions (role_code, permission_code)
  values ('staff_admin', 'org.professionals.read');

select test_helpers.claims_for((select xb from f409), false, 'staff_admin'); set local role authenticated;
select is((select count(*)::int from public.professional_profiles
            where id = 'fb000000-0000-0000-0000-00000000f409'), 0,
  '4.12 ⭐ ...and with the grant RESTORED the cross-org staff_admin still reads nothing. So the '
  'permission is scoped, not global: holding `org.professionals.read` at a Rede B commission does '
  'not reach a Rede A organization. `authz.scope_reaches` ascends, it does not cross tenants.');
reset role;

select test_helpers.claims_for((select sa from f409), false, 'staff_admin'); set local role authenticated;
select is((select count(*)::int from public.professional_profiles
            where id = 'fb000000-0000-0000-0000-00000000f409'), 1,
  '4.13 THE RESTORE IS PROVEN: the same restored grant reopens the door for the in-tenant '
  'staff_admin, so 4.12''s zero is scope and 4.7''s zero was the grant.');
reset role;

-- ---------- the §6A hat asymmetry must SURVIVE the re-key ----------
select test_helpers.claims_for((select sa from f409), false, 'staff');
select ok(not app.can_read_professional_profile('fb000000-0000-0000-0000-00000000f409', (select sa from f409)),
  '4.14 ⭐ THE SELF-CHECK HAT STILL APPLIES: same principal, same grant, but the ACTIVE role is '
  '`staff`, so the `staff_admin` assignment that carries the code is not wearing its hat and the '
  'answer is FALSE. `authz.entailed_grants` carries the §6A asymmetry clause verbatim from '
  '`holds_role`, so the re-key preserved it — an implementation that dropped it passes every '
  'other assertion in this suite.');

select test_helpers.claims_for((select st from f409), false, 'staff');
select ok(app.can_read_professional_profile('fb000000-0000-0000-0000-00000000f409', (select sa from f409)),
  '4.15 ⭐ ...AND THE THIRD-PARTY CHECK STILL IGNORES IT: a different caller asking about the same '
  'principal gets TRUE, because `p_principal <> auth.uid()`. Exactly one fact changed between '
  '4.14 and 4.15 — who is asking. Uniform-apply breaks the `_for` sites, never-apply drops the '
  'gate for the self-check sites; neither uniform choice is correct (401 §16.11).');

select test_helpers.reset_role_and_claims();

-- ============================================================================
-- §5 — WHAT THIS INCREMENT DID **NOT** MOVE. D6 re-keys three permissions; the other forty stay
-- on layer 1 through `app.is_staff_admin_of`, whose ELSE class alone covers 38 of the 43 codes
-- (401 §19.2). Re-keying the wrapper itself would have cut all 38 over silently — the exact
-- opposite of D6.
-- ============================================================================

select is((select count(*)::int from pg_policies
            where coalesce(qual,'') || coalesce(with_check,'') ~ '\yis_staff_admin_of\y'), 57,
  '5.1 ⭐ THE WRAPPER''S SURFACE MOVED BY EXACTLY SIX, IN TWO STEPS. It sat in 63 policies at head '
  '20261003007260 (the figure ADR 0176 Context records); 20261003007300 took the four form write '
  'policies (63 -> 59) and 20261003007340 took the remaining two, `form_item_options` and '
  '`form_item_validations` (59 -> 57). ⛔ 59 WAS NOT A WRONG NUMBER, IT WAS A COMPLETE ONE FOR A '
  'PARTIAL RE-KEY — which is exactly BUG-AE49-D6-REKEY-INCOMPLETE: this assertion sat GREEN on a '
  'catalog where two of the six sites the PO-approved matrix names had not moved, because a count '
  'of what REMAINS cannot see what SHOULD have gone. 410 § 8 is the arm that can. ⚠ Each further '
  'AE5 re-key moves this number DOWN; a red here is the increment being recorded, never a number '
  'to restore. ⛔ `\y` is used deliberately: the bare name only. The `_for` '
  'variant cannot be matched by a `\y`-anchored probe because `_` is a word character — that is '
  'a known false-negative trap (authz-handoff §7.2 case 2), and it is why 5.2 counts the prefix '
  'separately rather than reusing this pattern.');

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('app','public','authz')
              and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'is_staff_admin_of'), 179,
  '5.2 ...and its FUNCTION-body surface did not move at all: 179 bodies reference the `_of`/`_for` '
  'pair (unanchored prefix match — 151 + 28, the two figures 0176 Context records). This '
  'increment touched no function that calls the wrapper.');

select ok((select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'is_staff_admin_of')
          ~ 'authz\.holds_role'
      and (select count(*)::int from pg_temp.code_sites() where site = 'app.is_staff_admin_of') = 0,
  '5.3 STRUCTURAL: the wrapper still asks a ROLE question through layer 1 and carries NO '
  'permission-code literal. 0176''s own argument is that no code can stand for "is this user a '
  'staff_admin here" — a sentinel breaks on its own revoke, "holds any staff_admin code" turns '
  'true for a plain staff the moment AE5 grants an overlap, and a 43rd marker permission is the '
  'role wearing a permission''s name.');

delete from authz.role_permissions
 where role_code = 'staff_admin' and permission_code = 'commission.forms.edit';
select test_helpers.claims_for((select sa from f409), false, 'staff_admin');
select ok(app.is_staff_admin_of_for((select cid from f409s), (select sa from f409)),
  '5.4 ⭐⭐ THE BEHAVIOURAL HALF OF "NOTHING ELSE MOVED": with `commission.forms.edit` DELETED, '
  'the wrapper still answers TRUE. It is a role predicate and the re-key did not make it '
  'permission-sensitive — so the 59 remaining policies and 179 function bodies that call it are '
  'unaffected by grant edits. ⛔ A count of sites is a structural claim; this is the answer.');

select is((select coalesce(string_agg(pm.code, ', ' order by pm.code), '(none)')
             from authz.permissions pm
            where not authz.has_permission(
                    (select sa from f409),
                    pm.resolution_scope_kind::text,
                    case pm.resolution_scope_kind::text when 'organization' then (select oid from f409s)
                                                        else (select cid from f409s) end,
                    pm.code)),
  'commission.forms.edit, org.professionals.manage',
  '5.5 ⭐ THE DELETE REMOVED EXACTLY ONE ENTITLEMENT. 401 §19.4 measures this staff_admin failing '
  'only `org.professionals.manage` (the code AE4.7c revoked); under this mutation she fails that '
  'one AND `commission.forms.edit`, and nothing else. ⛔ The expected value is a NAMED LIST, not a '
  'count: it reds on a lost grant, on the revoke being undone, and on a swap that a count could '
  'not see.');

insert into authz.role_permissions (role_code, permission_code)
  values ('staff_admin', 'commission.forms.edit');
select test_helpers.reset_role_and_claims();

-- ============================================================================
-- §6 — THE NEW DOOR INHERITS EVERY SIBLING ARM. A new gate is in no BLIND set, so it passes the
-- door sweep's policy arm vacuously (ADR 0079 Amendment 3) — its shape has to be asserted here.
-- ============================================================================

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app'
              and p.proname in ('can_edit_commission_forms','can_create_professional','can_read_professional_profile')
              and p.prosecdef
              and p.proconfig is not null
              and 'search_path=app, public, pg_catalog' = any (p.proconfig)), 3,
  '6.1 ALL THREE authorizers are SECURITY DEFINER with the pinned house `search_path`. '
  '⛔ `prosecdef` belongs beside `pg_policies`: a DEFINER function''s gate REPLACES RLS, so its '
  'security attributes are part of the door, not metadata.');

select is((select count(*)::int
             from unnest(array['anon','authenticated','service_role']) r
            where has_function_privilege(r, 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE')), 2,
  '6.2 ACL: the new authorizer is executable by `authenticated` and `service_role` and NOT by '
  '`anon` — the exact ACL of the two wrappers it replaces at those four policy sites. A policy '
  'expression runs as the querying role, so a missing grant here would 42501 every form write; '
  'an extra `anon` grant would widen the door. ⛔ Effective privilege, never `proacl` text — a '
  'NULL proacl includes PUBLIC.');

grant execute on function app.can_edit_commission_forms(uuid,uuid) to anon;
select ok(has_function_privilege('anon', 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE'),
  '6.3 VACUITY CONTROL for 6.2: an explicit grant IS observable, so 6.2''s "not anon" is an '
  'observation rather than a stuck predicate.');
revoke execute on function app.can_edit_commission_forms(uuid,uuid) from anon;
select ok(not has_function_privilege('anon', 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE'),
  '6.4 ...and revoking closes it again, leaving §6 as it found the ACL.');

-- ⛔ CLEANUP BY IDENTITY, never positionally — a positional cleanup eats seed rows ~900 tests
-- depend on. The enclosing transaction rolls back regardless; this is about the assertions that
-- run between here and the rollback, and about what an out-of-transaction run would have to do.
delete from public.professional_profiles where id = 'fb000000-0000-0000-0000-00000000f409';
delete from public.form_sections where form_version_id in
  (select id from public.form_versions where form_id = (select fid from f409s) and version_number = 9091);
delete from public.form_versions where form_id = (select fid from f409s) and version_number = 9091;
delete from public.forms where title like '409 %';

select * from finish();
rollback;
