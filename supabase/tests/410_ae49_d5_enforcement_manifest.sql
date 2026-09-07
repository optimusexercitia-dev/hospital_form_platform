-- 410 — AE4.9 / ADR 0176 D5: the ENFORCEMENT MANIFEST bound to the LIVE CATALOG.
--
-- Subject: supabase/tests/vectors/authz-enforcement-manifest.json, via the generated fixture
--          supabase/tests/vectors/authz_enforcement_manifest.psql.
-- Sibling gate: `npm run lint:authz-vectors` (gate 12).
--
-- ⛔⛔ WHY THE WORK IS SPLIT ACROSS TWO GATES, AND WHY MOVING IT BACK IS A REGRESSION.
-- `npm run lint` chains twelve gates and must never require Docker. So the lint half is PURE
-- JSON: it proves the manifest is internally consistent, carries NO DEFAULT ARM, and agrees
-- with the COMMITTED SNAPSHOT inside the manifest. It cannot prove that snapshot is current —
-- nothing without a database can. THIS FILE is that proof, and it runs where the DB is
-- already up. Putting a live catalog query into the lint script would make `npm run lint`
-- need Docker; putting these assertions into JSON would make them assert a copy of themselves.
--
-- ⛔ THE CATALOG IS TRUTH HERE, NOT THE MIGRATION TEXT. Some migrations in this tree rewrite
-- function bodies at runtime via pg_get_functiondef() + replace() + execute, so a migration
-- file can never be trusted to describe what shipped (ADR 0078 METHODOLOGY FINDING). Every
-- assertion below reads pg_proc / pg_policies / the ACLs.
--
-- ⚠ THIS SUITE DOES NOT CALL test_helpers.bootstrap(). Its subjects are the real seeded
-- catalog and the real policy/function population, which bootstrap's `truncate ... cascade`
-- would destroy. It creates exactly one fixture object (§ 4's probe), in `app`, and drops it
-- before leaving the section; the whole file rolls back regardless.
--
-- RUN SHAPE: `Files=2, Tests=45` (44 here + 00_setup.sql's one).
-- §1 4 · §2 6 · §3 7 · §4 6 · §5 3 · §6 6 · §7 4 · §8 8 = 44.
-- ⚠ 34 -> 40: § 8, the SITE-AXIS CLOSURE, added to close
-- FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE after BUG-AE49-D6-REKEY-INCOMPLETE shipped through
-- every green gate in this file. Read § 8's header before trusting anything below about sites.
-- ⚠ 32 -> 33 at authoring time: § 3.7 (the AUTHORIZER-composition arm) was added after § 3.5
-- red on the re-keyed catalog and the authority turned out to have MOVED rather than vanished.
-- ⚠ 33 -> 34: § 4.6, the residual-legacy-authority disclosure imposed as a CONDITION by the
-- lead on the ruling that a re-keyed policy calls only its authorizer. Without it § 4.5's
-- `re-keyed: 3` reads as "3 permissions fully on layer 3", which is false for all three.
-- ⚠ 40 -> 44 at 20261003007350 (pre-AE5 Batch 4, ADR 0193): § 6.2 became a SET EQUALITY over the
-- transitive call closure and gained its two controls (§ 6.2b planted, § 6.2c natural), and § 8
-- gained the DEFINER-writer closure (§ 8.7) and the authorizer-consumer partition (§ 8.8).
-- ⛔ NO ASSERTION WAS DELETED. § 8.5's by-name pin did NOT go away — the site it named became
-- DECLARED, so its element text flips `[UNDECLARED]` -> `[declared site]`. A reader looking for
-- a -1 on the account of "delete the pin" (the follow-up's phrasing) will not find one.

begin;
select plan(44);

\ir vectors/authz_enforcement_manifest.psql

-- ============================================================================
-- §1 — CARDINALITY CONTROLS, FIRST.
--
-- ⛔ Every set-difference assertion in §§2-7 has the form "count of rows that violate X = 0",
-- and an EMPTY fixture table satisfies all of them at once. That is the "detector that finds
-- nothing" shape, and it would report a perfect green for a manifest that failed to load.
-- These four run before anything that could be satisfied by absence.
-- ============================================================================

select ok((select count(*) from authz_manifest_permissions) > 0,
  '1.1 the manifest fixture LOADED and has rows. ⛔ Without this, every "violations = 0" '
  'assertion below passes over an empty table and the suite reports green for a manifest '
  'that never arrived.');

select is((select count(*)::int from authz_manifest_permissions), 43,
  '1.2 CARDINALITY CONTROL: the manifest declares exactly 43 enforcement rows. ⚠ If this '
  'reds because the catalog grew, that is the gate working — ADR 0176 D5 says a 44th '
  'permission breaks generation until someone names its enforcement path. Adjust this number '
  'only AFTER the new permission has a manifest row, never to make the red go away.');

select ok((select count(*) from authz_manifest_snapshot_permissions) > 0
      and (select count(*) from authz_manifest_snapshot_roles) > 0
      and (select count(*) from authz_manifest_approved_suites) > 0
      and (select count(*) from authz_manifest_hard_deny_vocab) > 0,
  '1.3 ...and every other fixture relation is populated too. The snapshot lists are the ONLY '
  'thing §2 compares against the catalog; an empty one would make both set differences pass.');

select is((select count(*)::int from authz_manifest_sites), 13,
  '1.4 CARDINALITY CONTROL for §3 AND §8: exactly 13 enforcement sites are declared (6 policies '
  'for commission.forms.edit, 3 RPCs for org.professionals.create, 2 policies + 2 functions for '
  'org.professionals.read). §3 asserts each EXISTS and §8 asserts each ENFORCES; without this '
  'count, deleting site rows would shrink both domains and every remaining assertion would '
  'still be green. ⚠ 10 -> 12 at 20261003007340: the two `form_item_options` / '
  '`form_item_validations` write policies were named by the PO-approved matrix, were NOT '
  're-keyed, and were absent from this list — BUG-AE49-D6-REKEY-INCOMPLETE. ⚠ 12 -> 13 on '
  '2026-09-07 (PO ruling Q1 = A, ADR 0193 D6): `app.current_professional_read_organizations` '
  'became a declared site — 8.5''s fourth carrier, which had been held green by a by-name '
  '`[UNDECLARED]` pin. ⛔ Raising this number is how a re-key is RECORDED; it is never how a §8 '
  'red is silenced.');

-- ============================================================================
-- §2 — THE SNAPSHOT vs THE LIVE CATALOG. This is D5's "generation fails on set difference in
-- EITHER direction", enforced where the catalog can actually be read.
--
-- ⛔ BOTH DIRECTIONS, AND THEY CATCH DIFFERENT THINGS. `catalog - snapshot` catches a new
-- permission nobody declared an enforcement path for. `snapshot - catalog` catches a manifest
-- row still asserting an enforcement path for a permission that was deleted. A one-way check
-- reads as coverage and is half a gate.
-- ============================================================================

select is(
  (select coalesce(string_agg(p.code, ', ' order by p.code), '(none)')
     from authz.permissions p
    where not exists (select 1 from authz_manifest_snapshot_permissions s where s.code = p.code)),
  '(none)',
  '2.1 CATALOG - SNAPSHOT is empty: every permission in authz.permissions appears in the '
  'manifest''s committed snapshot. ⛔ This is the 44th-permission tripwire. The message NAMES '
  'the codes, so the fix is "write the enforcement row", never "raise a count".');

select is(
  (select coalesce(string_agg(s.code, ', ' order by s.code), '(none)')
     from authz_manifest_snapshot_permissions s
    where not exists (select 1 from authz.permissions p where p.code = s.code)),
  '(none)',
  '2.2 SNAPSHOT - CATALOG is empty: the manifest declares no enforcement path for a '
  'permission the catalog no longer has. ⛔ The direction a one-way check misses.');

select is(
  (select coalesce(string_agg(m.code, ', ' order by m.code), '(none)')
     from authz_manifest_permissions m
     join authz.permissions p on p.code = m.code
    where m.resource_kind         is distinct from p.resource_kind::text
       or m.risk_class            is distinct from p.risk_class::text
       or m.sensitivity_ceiling   is distinct from p.sensitivity_ceiling::text
       or m.resolution_scope_kind is distinct from p.resolution_scope_kind::text),
  '(none)',
  '2.3 ⭐ THE FOUR-COLUMN MIRROR. Every manifest row reproduces its permission''s catalog '
  'classification, so a migration that re-classifies a permission REDS here until someone '
  're-reviews its enforcement row. ⚠ This is also the fuse that gives lint''s '
  'axes.sensitivity == catalog.sensitivityCeiling arm real teeth: lint pins the two manifest '
  'fields to each other, and this pins one of them to the database. ⛔ These four columns '
  'still have NO RUNTIME READER (ADR 0172 defers that); a TEST reader is not a consumer, and '
  'this assertion must never be cited as closing IA-F5.');

select is(
  (select coalesce(string_agg(x.code, ', ' order by x.code), '(none)') from (
     select r.code from authz.roles r
      where not exists (select 1 from authz_manifest_snapshot_roles s where s.code = r.code)
     union all
     select s.code from authz_manifest_snapshot_roles s
      where not exists (select 1 from authz.roles r where r.code = s.code)) x),
  '(none)',
  '2.4 the role snapshot equals authz.roles, BOTH DIRECTIONS. A role added to the catalog '
  'without a manifest snapshot entry, or a snapshot entry for a role that was dropped, reds.');

select is(
  (select coalesce(string_agg(s.code, ', ' order by s.code), '(none)')
     from authz_manifest_snapshot_roles s
     join authz.roles r on r.code = s.code
    where s.state is distinct from r.state::text
       or s.session_selectable is distinct from r.session_selectable),
  '(none)',
  '2.5 ...and each snapshot role reproduces its live `state` and `session_selectable`. ⛔ '
  'THIS IS WHAT KEEPS §7 HONEST: §7 asks "does every authoritative role have a suite", and it '
  'reads the LIVE table — but lint asks the same question of the SNAPSHOT. Without this, a '
  'role could flip to authoritative in the database while the snapshot still said `legacy`, '
  'and lint would keep passing on a stale premise.');

select is(
  (select coalesce(string_agg(x.code, ', ' order by x.code), '(none)') from (
     select m.code from authz_manifest_permissions m
      where not exists (select 1 from authz_manifest_snapshot_permissions s where s.code = m.code)
     union all
     select s.code from authz_manifest_snapshot_permissions s
      where not exists (select 1 from authz_manifest_permissions m where m.code = s.code)) x),
  '(none)',
  '2.6 the manifest''s ROW KEYS equal its own SNAPSHOT LIST, both directions. ⚠ lint asserts '
  'this too, and the duplication is deliberate: lint compares the JSON, this compares the '
  'GENERATED FIXTURE, so a hand-edited .psql that slipped past a stale --check is caught by a '
  'gate that never reads the JSON at all.');

-- ============================================================================
-- §3 — EVERY DECLARED ENFORCEMENT SITE EXISTS.
--
-- ⛔ A manifest that names sites nobody can find is worse than one that names none: it reads
-- as attribution. `a rename orphans a name-keyed verdict` is the standing shape — these rows
-- are name-keyed, so a policy rename must red here rather than quietly emptying the mapping.
-- ============================================================================

select is(
  (select coalesce(string_agg(s.code || ' -> ' || s.site_schema || '.' || s.site_relation ||
                              ' / ' || s.site_name, ', ' order by s.site_name), '(none)')
     from authz_manifest_sites s
    where s.site_kind = 'policy'
      and not exists (select 1 from pg_policies p
                       where p.schemaname = s.site_schema and p.tablename = s.site_relation
                         and p.policyname = s.site_name)),
  '(none)',
  '3.1 every POLICY site named in the manifest exists in pg_policies.');

select is(
  (select coalesce(string_agg(s.code || ' -> ' || s.site_schema || '.' || s.site_name,
                              ', ' order by s.site_name), '(none)')
     from authz_manifest_sites s
    where s.site_kind = 'function'
      and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = s.site_schema and p.proname = s.site_name)),
  '(none)',
  '3.2 every FUNCTION site named in the manifest exists in pg_proc.');

-- ⭐ 3.3 / 3.4 — THE DETECTORS ARE PROVEN ABLE TO FIND SOMETHING. 3.1 and 3.2 are
-- "violations = 0" assertions, which a broken lookup satisfies exactly as well as a correct
-- one. These two feed a site that CANNOT exist and require the same expressions to name it.
select is(
  (select count(*)::int from (values ('zzfix', 'policy', 'public', 'zzfix_no_such_table', 'zzfix_no_such_policy')) as s(code, site_kind, site_schema, site_relation, site_name)
    where s.site_kind = 'policy'
      and not exists (select 1 from pg_policies p
                       where p.schemaname = s.site_schema and p.tablename = s.site_relation
                         and p.policyname = s.site_name)),
  1,
  '3.3 VACUITY CONTROL for 3.1: the SAME policy-lookup expression, fed a policy that does not '
  'exist, reports it. So 3.1''s "(none)" is an observation, not a stuck pass.');

select is(
  (select count(*)::int from (values ('zzfix', 'function', 'app', 'zzfix_no_such_function')) as s(code, site_kind, site_schema, site_name)
    where s.site_kind = 'function'
      and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = s.site_schema and p.proname = s.site_name)),
  1,
  '3.4 VACUITY CONTROL for 3.2, same construction for the function lookup.');

-- §3.5 / §3.6 — the COMPOSITION check. ⛔ This is the assertion that survives the re-key.
-- Three of the four form policies read `is_staff_admin_of(...) OR is_tenancy_admin_of(...)`,
-- and the tenancy arm is a DIFFERENT AUTHORITY with a different population. "Re-keyed" must
-- never mean the policy body collapses to one permission check, so each site records what it
-- is composed with and that composition is asserted, not remembered.
create or replace function pg_temp.policy_body(p_schema text, p_table text, p_policy text)
returns text language sql stable as $$
  select coalesce(qual, '') || ' ' || coalesce(with_check, '')
    from pg_policies
   where schemaname = p_schema and tablename = p_table and policyname = p_policy;
$$;

create or replace function pg_temp.fn_body(p_schema text, p_name text)
returns text language sql stable as $$
  -- ⚠ `--` comments stripped: a gate NAMED in a comment is not a gate CALLED in the body,
  -- and the standing "a prosrc regex matching comments" trap is exactly this. ⛔ BOUND, NAMED:
  -- /* */ block comments are NOT stripped, so a composedWith name that appears only inside one
  -- would be counted as present. No body in the current population uses them at a gate call.
  select string_agg(regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g'), ' ')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = p_schema and p.proname = p_name;
$$;

select is(
  (select coalesce(string_agg(s.site_name || ' lost ' || c.fn, ', ' order by s.site_name, c.fn), '(none)')
     from authz_manifest_sites s, unnest(s.composed_with) as c(fn)
    where position(c.fn || '(' in
            case s.site_kind
              when 'policy' then pg_temp.policy_body(s.site_schema, s.site_relation, s.site_name)
              else               coalesce(pg_temp.fn_body(s.site_schema, s.site_name), '')
            end) = 0),
  '(none)',
  '3.5 ⭐⭐ EVERY `composedWith` AUTHORITY IS STILL PRESENT AT ITS SITE. ⛔ THIS ASSERTION '
  'ALREADY EARNED ITS KEEP: on its first run against the re-keyed catalog it RED, because the '
  'four commission.forms.edit policies had collapsed from `is_staff_admin_of(...) OR '
  'is_tenancy_admin_of(...)` to a single authorizer call. The tenancy arm turned out to be '
  'PRESERVED INSIDE the authorizer (§ 3.7 is what asserts that), but nothing at this level '
  'could have told the two apart, and "the policy got simpler" is exactly what a silent '
  'narrowing looks like. '
  '⚠ THE NEEDLE IS `name || ''(''`, NOT THE BARE NAME. The preserved arm was ALSO renamed to '
  'the `_for` variant, and a bare-substring match for `app.is_tenancy_admin_of` matches '
  '`app.is_tenancy_admin_of_for(` as a PREFIX — it would have reported the old name as still '
  'present and hidden the rename. Matching a CALL is what keeps a rename visible.');

select is(
  (select count(*)::int from authz_manifest_sites s, unnest(s.composed_with) as c(fn))
  + (select count(*)::int from authz_manifest_permissions m, unnest(m.authorizer_composed_with) as c(fn)),
  21,
  '3.6 CARDINALITY CONTROL for 3.5 AND 3.7: 13 (site, authority) pairs plus 8 (authorizer, '
  'authority) pairs were checked. Both are "violations = 0" assertions over an UNNEST — '
  'emptying `composedWith` everywhere would satisfy both perfectly while checking nothing. '
  '⚠ The 8 authorizer pairs are 2 for can_edit_commission_forms, 2 for '
  'can_create_professional, 4 for can_read_professional_profile. ⚠ 20 -> 21 on 2026-09-07: the '
  'new site `app.current_professional_read_organizations` composes '
  '`authz.authorized_scope_ids`, and 3.5 now checks that composition like any other.');

select is(
  (select coalesce(string_agg(m.code || ': authorizer lost ' || c.fn, '; ' order by m.code, c.fn), '(none)')
     from authz_manifest_permissions m, unnest(m.authorizer_composed_with) as c(fn)
    where m.domain_authorizer is not null
      and position(c.fn || '(' in
            coalesce(pg_temp.fn_body(split_part(m.domain_authorizer, '.', 1),
                                     split_part(m.domain_authorizer, '.', 2)), '')) = 0),
  '(none)',
  '3.7 ⭐⭐ ...AND EVERY AUTHORITY THE AUTHORIZER COMPOSES IS STILL INSIDE IT. This is the '
  'level § 3.5 cannot see, and the re-key is why it exists: authority MOVED from the policy '
  'bodies into app.can_edit_commission_forms, so from AE4.9 onward deleting the tenancy-admin '
  'arm is a one-line edit inside a DEFINER function that no policy-level assertion observes. '
  '⛔ Each of the three authorizers must still compose BOTH its permission check '
  '(authz.has_permission) AND its preserved legacy arm — dropping either one is a silent '
  'population change, in opposite directions: dropping the legacy arm locks out org_admin / '
  'hospital_admin, dropping the permission arm makes the catalog inert again, which is the '
  'exact defect ADR 0176 was written to repair.');

-- ============================================================================
-- §4 — THE STATUS <-> CATALOG TRIPWIRE (ADR 0176 D3, the manifest countdown).
--
-- ⭐⭐ WHAT THIS IS FOR, AND WHY IT IS STRICT IN BOTH DIRECTIONS. D3 says the count of
-- product callers still on layer 1 reaches ZERO by AE5-complete, and D5 says sites not yet
-- re-keyed are EXPLICIT `pending-rekey` entries. Both are worthless if the manifest can say
-- `pending-rekey` while the site is actually re-keyed — the status would be a label nobody
-- maintains, which is "absence of a verdict read as absence of coverage".
--
-- So `status` is made a TOTAL FUNCTION OF THE CATALOG: a permission is re-keyed exactly when
-- some app/public function carries its code as a string literal (D7's "statically greppable
-- at the enforcement sites"). When the re-key lands, 4.3 REDS until the manifest row is
-- flipped. That red is the gate working, and the coordination round is the price of the
-- countdown being real.
-- ============================================================================

create or replace function pg_temp.carriers_of(p_code text) returns text
language sql stable as $$
  -- ⛔ `position(... in ...)`, NOT a regex. Permission codes contain `.`, which a regex would
  -- read as "any character" — `commission.forms.edit` would then match `commissionXformsYedit`
  -- and, worse, would match a DIFFERENT code that happened to differ only in a separator.
  -- The quotes around the code are part of the needle: this looks for a STRING LITERAL, not a
  -- mention.
  select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname), '(none)')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and position('''' || p_code || '''' in
                  regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')) > 0;
$$;

-- ⭐⭐ THE POSITIVE CONTROL RUNS FIRST AND CONSTRUCTS ITS OWN SUBJECT. Today ZERO functions
-- carry a permission code, so 4.3 asserts "(none)" for all 43 and would report an identical
-- green if `carriers_of` were simply broken. A detector that finds nothing must be proven
-- able to find something.
-- ⚠ THE PROBE CARRIES A SYNTHETIC CODE, NOT A REAL ONE, AND THE FIRST DRAFT GOT THIS WRONG.
-- It used 'commission.forms.edit', which was carrier-free when written and acquired a REAL
-- carrier hours later when the re-key landed — so the positive control started reporting two
-- carriers and RED for a reason that had nothing to do with the detector. A control must not
-- share a subject with the thing under test. `zzfix.` is the file-local fixture prefix.
create function app._t410_probe() returns int
language sql immutable as $$ select length('zzfix.t410.synthetic_code') $$;

select is(pg_temp.carriers_of('zzfix.t410.synthetic_code'), 'app._t410_probe',
  '4.1 ⭐⭐ POSITIVE CONTROL: a function that DOES carry a code as a literal is found, and '
  'NAMED. Without this, § 4.3''s "(none)" over 40 pending codes is indistinguishable from a '
  'dead query — and § 4.4''s over 3 re-keyed codes from a permanently-true one.');

drop function app._t410_probe();

select is(pg_temp.carriers_of('zzfix.t410.synthetic_code'), '(none)',
  '4.2 NEGATIVE CONTROL: dropping the probe returns the detector to "(none)". So it tracks '
  'the catalog rather than being stuck on either answer — 4.1 and 4.2 together are the '
  'discrimination pair.');

select is(
  (select coalesce(string_agg(m.code || ' is carried by ' || pg_temp.carriers_of(m.code),
                              '; ' order by m.code), '(none)')
     from authz_manifest_permissions m
    where m.status = 'pending-rekey'
      and pg_temp.carriers_of(m.code) <> '(none)'),
  '(none)',
  '4.3 ⭐⭐ THE TRIPWIRE. No permission the manifest calls `pending-rekey` is actually carried '
  'by a domain authorizer. ⛔ IF THIS REDS, THE FIX IS TO UPDATE THE MANIFEST, NOT TO RELAX '
  'THE ASSERTION: reality has moved ahead of the record, which is exactly the drift D3''s '
  'countdown exists to detect. Flip the row to `re-keyed`, name its domainAuthorizer, and '
  'clear its pendingRekey block.');

select is(
  (select coalesce(string_agg(m.code, ', ' order by m.code), '(none)')
     from authz_manifest_permissions m
    where m.status = 're-keyed'
      and (m.domain_authorizer is null
           or pg_temp.carriers_of(m.code) = '(none)'
           or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname || '.' || p.proname = m.domain_authorizer))),
  '(none)',
  '4.4 ...and the converse: every `re-keyed` row names a domain authorizer that EXISTS and '
  'the code IS carried in the catalog. ⭐ THIS IS THE HALF THAT PROVES THE RE-KEY LANDED, and '
  'it is the half a manifest could otherwise satisfy by never flipping a row.');

select is(
  (select count(*)::int from authz_manifest_permissions where status = 'pending-rekey') || ' / ' ||
  (select count(*)::int from authz_manifest_permissions where status = 're-keyed')::text,
  '40 / 3',
  '4.5 ⭐ THE COUNTDOWN, PINNED, AS A PAIR. 40 pending-rekey and 3 re-keyed — the honest '
  'sentence ADR 0176 Consequences demands ("staff_admin runs on layer 1; N of 43 permissions '
  're-keyed, the rest pending-rekey") with N = 3, the PO-confirmed Gate AE4 minimum (D6: '
  'commission.forms.edit, org.professionals.create, org.professionals.read). ⛔ ASSERTED AS A '
  'PAIR, NOT AS ONE NUMBER: 40 alone is satisfied by a 44th permission arriving re-keyed, and '
  '3 alone by a row flipped without its site. Together they also prove neither § 4.3 nor '
  '§ 4.4 ranges over an empty set — 40 + 3 = 43, so the status partition is TOTAL and no row '
  'escaped both arms. Each further re-key moves this pair; a red here is the increment being '
  'recorded, never a number to restore.');

select is(
  (select coalesce(string_agg(m.code || ' via ' || c.fn, '; ' order by m.code, c.fn), '(none)')
     from authz_manifest_permissions m, unnest(m.residual_legacy_authority) as c(fn)
    where m.status = 're-keyed'),
  'commission.forms.edit via app.is_tenancy_admin_of_for; '
  'org.professionals.create via app.can_manage_professional; '
  'org.professionals.read via app.can_manage_professional; '
  'org.professionals.read via app.can_read_case_committee; '
  'org.professionals.read via app.is_admin',
  '4.6 ⭐⭐ `re-keyed` DOES NOT MEAN `fully permission-keyed`, AND THIS IS THE ASSERTION THAT '
  'STOPS § 4.5 BEING READ THAT WAY. All three re-keyed authorizers are DISJUNCTIONS: one arm '
  'is the permission check and the rest still grant on a role/identity path with NO permission '
  'grant involved. ⛔ WHY IT IS PINNED BY NAME RATHER THAN COUNTED: before the re-key these '
  'arms sat in the policy bodies, where anyone auditing pg_policies for surviving legacy '
  'authority would see them; they are now inside SECURITY DEFINER functions, invisible to '
  'exactly that audit (ADR 0079 door blindness). A count would let one arm be swapped for '
  'another silently. ⚠ ADDING an arm reds here, and so does RETIRING one — a retirement is '
  'AE5 progress and must be recorded, not absorbed. ⛔ Do not read the AE4 gate record as '
  '"3 of 43 permissions are on layer 3": it is "3 sites call layer 3 on the staff_admin path, '
  'and 5 non-permission grant paths survive inside them".');

-- ============================================================================
-- §5 — GRANT POSTURE OF THE TARGET AUTHORIZERS.
--
-- ⭐ THE SHAPE THIS CATCHES IS "a correct door nothing can reach". Measured 2026-09-02:
-- app.can_create_professional is NOT EXECUTE-granted to `authenticated`, so it can only ever
-- be reached through the three RPC sites — while app.can_read_professional_profile IS granted
-- and is embedded directly in two RLS policies. Two sibling gates, opposite postures. A
-- manifest that assumed one shape for both would have named an unreachable object as an
-- enforcement site and passed every set-difference check while doing it.
-- ============================================================================

select is(
  (select coalesce(string_agg(m.code || ' (' || m.authorizer || '): declared exec=' ||
                              m.authorizer_exec_authenticated::text || ', actual=' || g.granted::text,
                              ', ' order by m.code), '(none)')
     from authz_manifest_permissions m
     join lateral (
       -- ⚠ EVERY OVERLOAD, via bool_and. A name-keyed lookup that took `limit 1` would report
       -- the posture of whichever overload the planner happened to return, and a second
       -- overload granted to `authenticated` would be invisible.
       select bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')) as granted
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname || '.' || p.proname = m.authorizer
     ) g on true
    where m.authorizer is not null
      and g.granted is not null
      and g.granted is distinct from m.authorizer_exec_authenticated),
  '(none)',
  '5.1 every declared authorizer that EXISTS carries the grant posture the manifest declares '
  'for it. ⛔ Both polarities matter, and the two live cases are OPPOSITE: '
  'app.can_create_professional is NOT granted to `authenticated` (its only doors are three '
  'RPCs), while app.can_read_professional_profile IS (two RLS policies embed it directly). A '
  'gate that LOST its grant stops being reachable from its RLS sites — a silent deny-all; one '
  'that GAINED a grant became directly callable, bypassing the RPC that was its only door. '
  '⚠ The column is the UNIFIED `authorizer` (domain when re-keyed, target while pending), so '
  'this arm does not go vacuous the moment a row flips status.');

select is(
  (select count(*)::int from authz_manifest_permissions m
    where m.authorizer is not null
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname || '.' || p.proname = m.authorizer)),
  3,
  '5.2 CARDINALITY CONTROL for 5.1: all 3 declared authorizers exist at this head. ⛔ Without '
  'this, 5.1 would be free to range over zero rows and report the same "(none)". ⚠ THIS '
  'NUMBER READ 2 BEFORE THE RE-KEY LANDED (app.can_edit_commission_forms did not yet exist), '
  'and it moving to 3 is the control doing its job. It rises with each further re-key.');

select is(
  (select coalesce(string_agg(m.code, ', ' order by m.code), '(none)')
     from authz_manifest_permissions m
    where m.authorizer is not null and m.authorizer_provisional),
  '(none)',
  '5.3 no authorizer name is still marked PROVISIONAL. All three were pinned 2026-09-02; a '
  'provisional name left in the manifest is a rename waiting to orphan a name-keyed verdict, '
  'so it is gated rather than trusted to be tidied.');

-- ============================================================================
-- §6 — THE HARD-DENY VOCABULARY IS ALIVE, AND THE DECLARED LIST IS A SET EQUALITY AGAINST THE
-- LIVE TRANSITIVE CLOSURE.
--
-- ⚠⚠ REWRITTEN 2026-09-07 (pre-AE5 Batch 4, ADR 0193 D1-D4), closing
-- FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL as ONE change, which is what that follow-up demanded:
--   * the three re-keyed rows now DECLARE what the closure finds (`principal_inactive` on all
--     three, plus `respondent_exclusion` on org.professionals.read) — a committed, dated claim;
--   * § 6.2 became a per-row SET EQUALITY between that claim and a fixed point over the
--     composed-call closure, comment-stripped, seeded from the site bodies AND the authorizer,
--     with NO depth bound;
--   * § 6.2b plants a class on a synthetic root and requires the instrument to NAME it — the
--     positive control the old § 6.3 said in its own words it was not;
--   * § 6.2c makes two REAL rows answer differently with the same instrument;
--   * the lint arm M7 gained three assertions that can fail on the empty case, so a transitive
--     § 6.2 does not just move the vacuity one level up (the follow-up's ⛔).
-- ⛔ THE BOUND THAT SURVIVES, AND IT IS IN THE PROVENANCE VALUE'S OWN NAME
-- (`measured-transitive-over-gated-classes`): only 3 of these 7 classes have a `gate` for a
-- call search to find. `record_immutable_published`, `record_immutable_submitted` (triggers),
-- `tenant_mismatch` (the UUID id-space) and `sensitivity_ceiling` (ADR 0172 defers the runtime
-- consumer) are structurally unfindable at ANY depth. Filed:
-- FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR (PO ruling Q5).
--
-- ⛔⛔ ORIGINAL HEADER, KEPT VERBATIM BELOW AS THE RECORD OF THE DEPTH-1 STATE (LEARN-088 — a
-- correction is a dated note beside the original, never a rewrite). Its ⛔ about a one-hop raise
-- being a partial fix that reads as a complete one is exactly why the replacement is a fixed
-- point rather than a bigger number, and its ATTRIBUTION CORRECTION is a standing lesson about
-- this very file. Everything it says about the depth-1 arm is true OF THE ARM IT DESCRIBES,
-- which no longer exists.
--
-- ---------------------------------------------------------------------------
-- ⛔⛔ READ THE DEPTH BEFORE READING THE ZERO. § 6.2 searches exactly two body classes: the
-- ENUMERATED SITE BODIES and the DOMAIN AUTHORIZER BODY. Call that depth 1. It does NOT walk
-- the composed-call closure below them, and it never has. The label was renamed
-- `measured-at-declared-sites` -> `measured-depth1-at-sites-and-authorizer` on 2026-09-03
-- (review F-MAJOR-1, remediation (a)) because the old name read as a closure it never had.
--
-- ⚠ THE EMPTY LIST IS A BOUND, NOT AN ABSENCE. `principal_inactive` (`app.is_active`) IS
-- enforced on ALL THREE rows carrying the measured label. Re-derived on the live catalog
-- 2026-09-03 with comments stripped (depth 1 = the bodies this section searches):
--   * permission arm, all 3 rows .......... depth 4  has_permission -> entailed_grants
--                                                    -> assignment_facts -> is_active
--   * commission.forms.edit, preserved arm  depth 2  app.is_tenancy_admin_of_for
--   * org.professionals.create,  "     "    depth 3  app.can_manage_professional -> is_org_admin_of
--   * org.professionals.read,    "     "    depth 3  app.can_manage_professional -> is_org_admin_of
--   * org.professionals.read also reaches `respondent_exclusion` at depth 5, through
--     app.can_read_case_committee -> ... -> app._case_caps -> app.is_case_respondent
-- ⛔ "depth 2 on both arms" holds for ONE arm of ONE row. Raising the
-- search by a single hop would catch that path and leave the other five unmeasured — the
-- partial fix that reads as a complete one.
--
-- ⚠ ATTRIBUTION CORRECTED 2026-09-04 (QA re-review N6). This line used to say *"THE REVIEW'S
-- phrase"*, and the review never wrote it. Measured tree-wide with markdown-normalised,
-- whitespace-collapsed matching: `depth 2 on both arms` occurs 0 times in
-- docs/reviews/authz-ae4-gate-review.md, while the same instrument still finds other phrases
-- from that file — so the zero is a real absence, not a dead detector. The phrase entered the
-- tree through the LEAD'S SPAWN PROMPT, was echoed back in the implementing agent's report,
-- and was written here as the review's. What the review actually wrote is *"there is a live
-- depth-2 instance it cannot see"* (`app.is_tenancy_admin_of_for`, which IS at depth 2 —
-- correct) and, for `assignment_facts`, *"layer 1"* — the architectural LAYER, also correct.
-- The error was collapsing *layer* into *search depth*, and it was ours, not the reviewer's.
-- ⭐ Kept rather than deleted because the observation above is TRUE; only the attribution was
-- false. Model for the correct form: docs/followups/FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL.md,
-- which said *"the AE4 hub recorded"* and got it right while this file and the manifest did not.
--
-- The transitive measurement plus a positive
-- control is the END STATE, tracked as FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL; it must land
-- together with that follow-up's M7 fix (lint's `hardDenyClasses` loop iterates an empty
-- list zero times), or a transitive § 6.2 only moves the vacuity one level up.
-- ============================================================================

select is(
  (select coalesce(string_agg(v.class_name || ' -> ' || v.gate, ', ' order by v.class_name), '(none)')
     from authz_manifest_hard_deny_vocab v
    where v.gate is not null
      and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname || '.' || p.proname = v.gate)),
  '(none)',
  '6.1 every hard-deny class that names a GATE names one that exists (app.is_case_excluded, '
  'app.is_case_respondent, app.is_active). A rename would otherwise leave the vocabulary '
  'pointing at nothing while every row still validated against it.');

-- ⛔⛔ THE INSTRUMENT, DEFINED ONCE AND USED BY 6.2, 6.2b AND 6.2c ALIKE. A fixed point over
-- the composed-call closure, seeded from ROOT BODY TEXT (not from a function name), so the
-- planted control in 6.2b can hand it a synthetic root and get an answer from the SAME code
-- path the real rows get. ⛔ IT DEDUPES ON THE REACHED-FUNCTION SET, NEVER ON PATHS: measured
-- while authoring, a path-enumerating recursion bounded at depth 10 produced 1232 paths for
-- org.professionals.read and was still growing, and the unbounded form had to be killed. The
-- reached set is a subset of pg_proc over three schemas and `union` dedupes, so the fixed point
-- terminates — that is the bound, and it is why no depth cap appears anywhere below (a depth
-- cap stated without saying which root it counts from is the LEARN-077 shape this section
-- already suffered once: the measured depths are 2/3/4/5 authorizer-rooted and +1 policy-rooted).
-- ⚠ `collate "C"` is load-bearing, not decoration: without it Postgres refuses the recursive
-- term with a collation conflict.
-- ⚠ BOUNDS, NAMED: edges are `(app|authz|public).name(` calls in comment-stripped `prosrc`, so
-- an UNQUALIFIED call resolved through `search_path` is not an edge; and `--` comments are
-- stripped while `/* */` block comments are not (the bound `fn_body` states at its definition).
create or replace function pg_temp.hard_deny_closure(p_roots text[])
returns text[] language sql stable as $$
  with recursive
  edges as (
    select (n.nspname || '.' || p.proname) collate "C" as caller,
           (m.g)[1] collate "C"                        as callee
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral regexp_matches(
        regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g'),
        '((?:app|authz|public)\.[a-z0-9_]+)[[:space:]]*\(', 'g') as m(g)
     where n.nspname in ('app', 'authz', 'public')
  ),
  reach as (
    select distinct (m.g)[1] collate "C" as fn
      from unnest(p_roots) as r(body)
      cross join lateral regexp_matches(
        coalesce(r.body, ''), '((?:app|authz|public)\.[a-z0-9_]+)[[:space:]]*\(', 'g') as m(g)
    union
    select e.callee from edges e join reach x on e.caller = x.fn
  )
  select coalesce(array_agg(distinct fn::text order by fn::text), '{}'::text[]) from reach;
$$;

-- The roots of a row: every declared site body PLUS the domain authorizer body. ⭐ THE
-- AUTHORIZER IS A ROOT IN ITS OWN RIGHT because the re-key MOVED authority off the policies and
-- into it; a site-only seed would make a hard deny added there invisible.
create or replace function pg_temp.hard_deny_roots(p_code text)
returns text[] language sql stable as $$
  select coalesce((select array_agg(case s.site_kind
                                      when 'policy' then coalesce(pg_temp.policy_body(s.site_schema, s.site_relation, s.site_name), '')
                                      else               coalesce(pg_temp.fn_body(s.site_schema, s.site_name), '')
                                    end)
                     from authz_manifest_sites s where s.code = p_code), '{}'::text[])
      || array[coalesce(pg_temp.fn_body(split_part(coalesce(m.domain_authorizer, '.'), '.', 1),
                                        split_part(coalesce(m.domain_authorizer, '.'), '.', 2)), '')]
    from authz_manifest_permissions m where m.code = p_code;
$$;

-- The gated sub-vocabulary reached from a set of roots, as a sorted comma list.
create or replace function pg_temp.hard_deny_derived(p_roots text[])
returns text language sql stable as $$
  select coalesce(string_agg(v.class_name, ',' order by v.class_name), '(none)')
    from authz_manifest_hard_deny_vocab v
   where v.gate is not null
     and v.gate = any(pg_temp.hard_deny_closure(p_roots));
$$;

select is(
  (select string_agg(m.code || ': ' || pg_temp.hard_deny_derived(pg_temp.hard_deny_roots(m.code)),
                     ' | ' order by m.code)
     from authz_manifest_permissions m
    where m.hard_deny_provenance like 'measured-%'),
  (select string_agg(m.code || ': ' ||
                     case when cardinality(m.hard_deny_classes) = 0 then '(none)'
                          else array_to_string(m.hard_deny_classes, ',') end,
                     ' | ' order by m.code)
     from authz_manifest_permissions m
    where m.hard_deny_provenance like 'measured-%'),
  '6.2 ⭐⭐ THE COMMITTED CLAIM EQUALS THE LIVE TRANSITIVE MEASUREMENT, PER ROW, BOTH SIDES '
  'NAMED. `have` is derived from the LIVE catalog at run time; `want` is the manifest''s '
  'hand-written `hardDenyClasses`, committed and dated 2026-09-07. ⛔⛔ THE ASYMMETRY OF THE TWO '
  'SIDES IS THE WHOLE ASSERTION (LEARN-084): the generator that emits `want` never opens a '
  'database connection, so this is a committed claim against a live derivation and not a number '
  'compared to itself. Give the generator a catalog read and this arm silently becomes a '
  'self-comparison with nothing to notice — that is why it is ADR 0193 D1, a decision, not a '
  'code comment. EXPECTED TODAY, IN FULL: `commission.forms.edit: principal_inactive | '
  'org.professionals.create: principal_inactive | org.professionals.read: principal_inactive,'
  'respondent_exclusion`. ⛔ A RED HERE NAMES WHAT MOVED and is an increment being RECORDED: '
  'any migration that changes a call chain moves the derived side, and the fix is to '
  're-measure and re-commit, never to widen the string. ⛔ THE ZERO THAT REMAINS IS STILL A '
  'ZERO: `recusal_exclusion` is reached by no row at any depth, and 6.2b is what makes that a '
  'measurement rather than a dead search. ⛔ AND THE CLOSURE IS OVER THE GATED SUB-VOCABULARY '
  'ONLY — 4 of the 7 classes carry `gate: null` (two triggers, the UUID id-space, ADR 0172''s '
  'deferred column) and no call search can ever reach them; the provenance value says so in its '
  'own name, and a non-call detector is filed as '
  'FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR.');

select is(
  'planted=' || pg_temp.hard_deny_derived(array['select app.is_case_excluded(v_case, v_uid)'])
  || ' | bare=' || pg_temp.hard_deny_derived(array['select 1 where true']),
  'planted=recusal_exclusion,respondent_exclusion | bare=(none)',
  '6.2b ⭐⭐ THE DISCRIMINATION CONTROL, PLANTED — the run that proves the instrument can return '
  'a class AT ALL. The same `hard_deny_closure` 6.2 uses is handed a SYNTHETIC ROOT naming '
  '`app.is_case_excluded`, and it must report `recusal_exclusion` — a class the real measurement '
  'returns for NO row, so the instrument returning it here can only be the predicate firing. '
  '⭐ AND IT PROVES THE WALK IS TRANSITIVE, NOT DEPTH-1: `respondent_exclusion` is NOT in the '
  'planted root, it is reached through `app.is_case_excluded -> app.is_recused_from_case -> '
  'app.is_case_respondent`. A depth-1 search would return `recusal_exclusion` alone and this '
  'arm would red. ⛔ THE PLANT IS A TEXT LITERAL PASSED AS AN ARGUMENT, never a catalog object: '
  'no `create function` in a real schema, no mutation, nothing to restore, and the negative '
  'half (`bare=`) is in the SAME assertion so a broken instrument that answers everything '
  'cannot pass either. ⛔ NOT the same thing as 6.3, which is a cardinality control and says so.');

select is(
  'read has respondent_exclusion=' ||
  ('respondent_exclusion' = any(string_to_array(
      pg_temp.hard_deny_derived(pg_temp.hard_deny_roots('org.professionals.read')), ',')))::text
  || ' / create has respondent_exclusion=' ||
  ('respondent_exclusion' = any(string_to_array(
      pg_temp.hard_deny_derived(pg_temp.hard_deny_roots('org.professionals.create')), ',')))::text,
  'read has respondent_exclusion=true / create has respondent_exclusion=false',
  '6.2c ⭐ THE DISCRIMINATION CONTROL, NATURAL — same instrument, same instant, two REAL rows, '
  'two different answers. `org.professionals.read` reaches `app.is_case_respondent` through '
  'can_read_case_committee -> is_oversight_only_reader -> has_case_capability -> _case_caps; '
  '`org.professionals.create` does not reach it at all. ⛔ 6.2b proves the instrument can say '
  'YES on a plant; this proves it can say NO on a real row that differs only in its call graph. '
  'A detector that returned every class for every row would pass 6.2b and fail here.');

select ok(
  (select count(*) from authz_manifest_permissions m join authz_manifest_sites s on s.code = m.code
    where m.hard_deny_provenance like 'measured-%') > 0
  and (select count(*) from authz_manifest_hard_deny_vocab where gate is not null) > 0
  and (select count(*) from authz_manifest_permissions
        where hard_deny_provenance like 'measured-%') = 3,
  '6.3 CARDINALITY CONTROL for 6.2: both of its domains are non-empty and the measured-row '
  'population is exactly 3. 6.2 aggregates over rows joined to sites and to the gated '
  'vocabulary; either going empty would make BOTH of its sides collapse to null and the '
  'equality would hold over nothing. ⚠ THIS IS A CARDINALITY CONTROL AND NOT A DISCRIMINATION '
  'ONE — it proves the domains have rows, never that the closure can return a class. ⭐ THAT '
  'GAP IS NOW CLOSED, and not by this arm: 6.2b plants a class the real rows never return and '
  'requires the same instrument to name it, and 6.2c makes two real rows answer differently. '
  '⚠ DATED NOTE, 2026-09-07: this caption used to end "the positive control that would close '
  'that gap is (b) in FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL; do not read this arm as supplying '
  'it." That follow-up is closed by this change and the control is 6.2b — the sentence is kept '
  'because the DISTINCTION it draws is the point (LEARN-088), not because the gap is still open.');

select is(
  (select coalesce(string_agg(m.code, ', ' order by m.code), '(none)')
     from authz_manifest_permissions m
    where m.hard_deny_provenance = 'not-attributable-until-rekey'
      and (m.site_count > 0 or not m.has_boundary)),
  '(none)',
  '6.4 THE ESCAPE-HATCH FENCE, RE-ASSERTED FROM THE FIXTURE. `not-attributable-until-rekey` '
  'is admissible ONLY on a row with zero enumerated sites AND a reviewed call-graph boundary. '
  '⚠ lint asserts this from the JSON; this asserts it from the GENERATED fixture, so a '
  'hand-edited .psql cannot smuggle the label onto a measurable row. ⛔ An allowance written '
  'for the genuinely-unmeasurable is the thing that silences the measured if it is not fenced.');

-- ============================================================================
-- §7 — D5's THIRD SET DIFFERENCE, read from the LIVE catalog rather than the snapshot.
-- ============================================================================

select is(
  (select coalesce(string_agg(r.code, ', ' order by r.code), '(none)')
     from authz.roles r
    where r.state::text = 'authoritative'
      and not exists (select 1 from authz_manifest_approved_suites a where a.role_code = r.code)),
  '(none)',
  '7.1 AUTHORITATIVE ROLES - APPROVED SUITES is empty (ADR 0176 D5, its own words). A role '
  'promoted to `authoritative` without an approved matrix and differential suite reds here.');

select is(
  (select coalesce(string_agg(r.code || ' (' || r.state::text || ')', ', ' order by r.code), '(none)')
     from authz.roles r
    where r.state::text <> 'legacy'
      and not exists (select 1 from authz_manifest_approved_suites a where a.role_code = r.code)),
  '(none)',
  '7.2 ...and the STRICTLY WIDER form: NON-LEGACY - approved suites. authz.role_state is '
  '{legacy, test_validation, authoritative}, so this also covers a role mid-differential, '
  'which D5''s `authoritative` wording alone would miss. ⭐ This is the predicate the '
  'generator''s `nonLegacyRoles` arm always had; AE4.9 POPULATED it rather than retiring it '
  'with its sibling, and this is its catalog-side twin.');

select is(
  (select count(*)::int from authz.roles where state::text = 'authoritative'), 1,
  '7.3 CARDINALITY CONTROL for 7.1/7.2: exactly ONE role is authoritative today '
  '(staff_admin). Both are "violations = 0" assertions and would be perfectly satisfied by a '
  'catalog in which NO role was non-legacy. ⚠ This number moves with each AE5 increment.');

select is(
  (select count(*)::int from authz_manifest_approved_suites), 1,
  '7.4 ...and exactly one approved suite is declared. ⛔ Pinned separately from 7.3: the two '
  'sides being equal is what 7.1 asserts, and a control that read the same table as the '
  'assertion it controls would be the assertion twice.');

-- ============================================================================
-- §8 — ⭐⭐ SITE-AXIS CLOSURE. THE AXIS THAT HAD NO CHECK IN EITHER DIRECTION.
--
-- ⛔ WHY THIS SECTION EXISTS. §2's set differences run on the PERMISSION axis. §3 asks only
-- whether each DECLARED site EXISTS (3.1/3.2) and still composes what it DECLARES (3.5).
-- Nothing asked whether a declared site actually enforces the row's permission, nor whether a
-- catalog object that enforces it is declared. That gap shipped a live defect:
-- BUG-AE49-D6-REKEY-INCOMPLETE — `commission.forms.edit` was re-keyed at 4 of the 7 sites its
-- PO-approved matrix names, this manifest declared exactly the 4 that had landed, with
-- `status: "re-keyed"` and `callGraphBoundary: null` (which is a COMPLETE-LIST claim), and every
-- gate in this file was green. ADR 0176 D5 says generation "fails on set difference in either
-- direction"; on the site axis that sentence was false, and the falseness was in the DECISION
-- RECORD, not merely in the coverage. Entry: FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE.
--
-- ⛔ WHY §3 COULD NOT HAVE CAUGHT IT, WHICH IS THE WHOLE POINT. §3.5 compares a site against the
-- manifest's OWN `composedWith` for that site. Both sides are the manifest. A site the manifest
-- never names is in neither side, so §3 ranges over the hand list and cannot see past its edge —
-- "your own enumeration is a closure claim too". §8 compares the manifest against the CATALOG.
--
-- ⛔ WHAT "ENFORCES" MEANS HERE — STATED AS A BOUND, NOT IMPLIED. A policy body never carries the
-- permission literal: layer 3 puts the code inside an authorizer FUNCTION by construction (0176
-- D2/D7). So the predicate is transitive to EXACTLY ONE HOP — a site reaches its code when its
-- own body carries the literal, OR it CALLS an `app`/`public` function that does. One hop is the
-- architecture and not a convenience: D2 forbids a policy or door from calling layer 1 or 2 for
-- a permission decision, so a site's authorizer is always its DIRECT callee. ⚠ A future site
-- that reached its code through an intermediate wrapper would read FALSE here and RED. That is
-- the correct answer, because that shape is itself a D2 finding — do not deepen the search to
-- make such a red go away.
--
-- ⚠ THE NEEDLE IS `name || '('`, for the reason §3.5 records: a bare-name match reports
-- `app.is_staff_admin_of` as present inside `app.is_staff_admin_of_for(` and hides a rename.
-- ⚠ AND THE CODE NEEDLE CARRIES ITS QUOTES, for the reason §4's `carriers_of` records: this
-- looks for a STRING LITERAL, not a mention, and `position` is used rather than a regex because
-- permission codes contain `.`.
-- ============================================================================

-- The hop-0 carrier set, materialised once: 283 policies x 4 carriers instead of 283 x ~1000
-- function bodies (measured: 9.9 s -> 0.15 s). ⚠ It is built from `authz.permissions`, i.e. the
-- LIVE catalog, never from the manifest — a carrier table sourced from the manifest would make
-- both directions below compare the manifest with itself, which is exactly the defect §8 exists
-- to close. §4's `app._t410_probe` has already been dropped by this point, so it is absent here.
create temp table t410_carriers on commit drop as
  select pm.code, n.nspname || '.' || p.proname as fn
    from authz.permissions pm
    join pg_proc p on true
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and position('''' || pm.code || '''' in
                  regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')) > 0;

-- ⚠ REUSES §3's `policy_body` / `fn_body` deliberately. One definition of "the body" across
-- §3.5, §6.2 and §8 means a fix to the extraction cannot leave one arm reading a different text
-- from another. Their bound (block comments are NOT stripped) is stated at their definition.
create or replace function pg_temp.reaches_code(
  p_kind text, p_schema text, p_relation text, p_name text, p_code text)
returns boolean language sql stable as $$
  with src as (
    select case p_kind
             when 'policy' then coalesce(pg_temp.policy_body(p_schema, p_relation, p_name), '')
             else               coalesce(pg_temp.fn_body(p_schema, p_name), '')
           end as b
  )
  select (select position('''' || p_code || '''' in src.b) > 0 from src)      -- hop 0
      or exists (select 1 from t410_carriers c, src                            -- hop 1
                  where c.code = p_code and position(c.fn || '(' in src.b) > 0);
$$;

select is(
  (select coalesce(string_agg(s.code || ' -> ' || s.site_schema || '.' ||
                              coalesce(s.site_relation || ' / ', '') || s.site_name,
                              '; ' order by s.code, s.site_name), '(none)')
     from authz_manifest_sites s
     join authz_manifest_permissions m on m.code = s.code
    where m.status = 're-keyed'
      and not pg_temp.reaches_code(s.site_kind, s.site_schema, s.site_relation, s.site_name, s.code)),
  '(none)',
  '8.1 ⭐⭐ DECLARED => ENFORCING. Every site a `re-keyed` row names actually reaches that row''s '
  'permission code in the live catalog. ⛔ THIS IS THE ARM THAT REDS ON THE DEFECT: measured at '
  'head 20261003007330, with the two matrix-named policies added to the manifest and the fix '
  'migration NOT applied, this reported `commission.forms.edit -> '
  'public.form_item_options / form_item_options_staff_admin_write; commission.forms.edit -> '
  'public.form_item_validations / form_item_validations_staff_admin_write` — the two sites still '
  'carrying `app.is_staff_admin_of(...) OR app.is_tenancy_admin_of(...)` verbatim. ⛔ IF THIS '
  'REDS, RE-KEY THE SITE OR RETRACT THE DECLARATION — never delete the row from the manifest to '
  'restore green, because 8.4 is watching that door from the other side.');

select ok(
  pg_temp.reaches_code('policy', 'public', 'forms', 'forms_staff_admin_write', 'commission.forms.edit'),
  '8.2 DISCRIMINATION PAIR, positive half: the SAME expression returns TRUE for a site that '
  'genuinely is re-keyed. ⛔ 8.1 and 8.4 are both "violations = 0" assertions, which a detector '
  'stuck on FALSE satisfies perfectly. Without this half, a broken `reaches_code` would report '
  'the same green as a fully re-keyed catalog.');

select ok(
  not pg_temp.reaches_code('policy', 'public', 'form_item_options', 'form_item_options_select',
                           'commission.forms.edit'),
  '8.3 DISCRIMINATION PAIR, negative half — and it is anchored on something correct BY DESIGN, '
  'not on a defect. `form_item_options_select` is the PERMISSIVE SELECT sibling on the SAME '
  'TABLE as one of 8.1''s subjects; it is gated on `app.is_member_of` and must NOT enforce a '
  'write permission. So the detector separates two policies on one table, which is the '
  'resolution 8.4 needs. ⛔ Never re-anchor this on a policy that is merely un-re-keyed — that '
  'would make the control go green the day the defect is fixed.');

select is(
  (select coalesce(string_agg(m.code || ' <- ' || pol.schemaname || '.' || pol.tablename ||
                              ' / ' || pol.policyname, '; ' order by m.code, pol.policyname), '(none)')
     from authz_manifest_permissions m
     join pg_policies pol on true
    where m.status = 're-keyed'
      and pg_temp.reaches_code('policy', pol.schemaname, pol.tablename, pol.policyname, m.code)
      and not exists (select 1 from authz_manifest_sites s
                       where s.code = m.code and s.site_kind = 'policy'
                         and s.site_schema   = pol.schemaname
                         and s.site_relation = pol.tablename
                         and s.site_name     = pol.policyname)),
  '(none)',
  '8.4 ⭐⭐ ENFORCING => DECLARED, the direction a one-way check misses. Every policy in the '
  'catalog that reaches a `re-keyed` code is named in that row''s `enforcementSites`. ⛔ This is '
  'what stops 8.1 being satisfiable by DELETION: shortening the site list makes 8.1''s domain '
  'smaller and its answer greener, and 8.4 immediately reports the sites that were dropped. '
  'Proven able to red: with 20261003007340 applied and the two new sites removed from the '
  'manifest, this reported both of them while 8.1 read "(none)". '
  '⚠ POLICIES ONLY, AND THE BOUND IS DELIBERATE — the FUNCTION population is not a settled site '
  'set (measured: four `app`/`public` functions reach `org.professionals.read`, of which one is '
  'the authorizer, one is a declared RPC site, and two are not declared), and pinning it here '
  'would be inventing a ruling. 8.5 covers the part of it that IS settled.');

select is(
  (select coalesce(string_agg(
            c.code || ' => ' || c.fn || ' [' ||
            case when c.fn = m.domain_authorizer then 'authorizer'
                 when exists (select 1 from authz_manifest_sites s
                               where s.code = c.code and s.site_kind = 'function'
                                 and s.site_schema || '.' || s.site_name = c.fn) then 'declared site'
                 else 'UNDECLARED' end || ']',
            '; ' order by c.code, c.fn), '(none)')
     from t410_carriers c
     join authz_manifest_permissions m on m.code = c.code),
  'commission.forms.edit => app.can_edit_commission_forms [authorizer]; '
  'org.professionals.create => app.can_create_professional [authorizer]; '
  'org.professionals.read => app.can_read_professional_profile [authorizer]; '
  'org.professionals.read => app.current_professional_read_organizations [declared site]',
  '8.5 ⭐⭐ EVERY LITERAL CARRIER IS CLASSIFIED, BY NAME — the follow-up''s "every catalog object '
  'carrying that literal appears in exactly one row" direction. Each carrier is the row''s '
  'AUTHORIZER, a DECLARED function site, or UNDECLARED. ⭐⭐ THE FOURTH ELEMENT FLIPPED '
  '`[UNDECLARED]` -> `[declared site]` ON 2026-09-07 (PO ruling Q1 = A, ADR 0193 D6). '
  '`app.current_professional_read_organizations` acquired the `org.professionals.read` literal '
  'at 20261003007320 as a deliberate SECOND site (ADR 0182; 409 §1.1 rules the duplication safe '
  'as a subset argument, 413 §2/§5 measure it) and is now DECLARED in that row''s '
  '`enforcementSites`. Measured: SECURITY DEFINER, `SETOF uuid`, `authenticated` EXECUTE true / '
  '`anon` false, and exactly ONE caller — an INDEPENDENT FIRST ARM of '
  '`professional_profiles_select` that short-circuits `can_read_professional_profile` entirely. '
  'Deny it and the answer changes, which is the operative test for a site. ⛔ THE PIN WAS NOT '
  'DELETED — the follow-up asked for the by-name pin to go, and what went is the EXCEPTION: the '
  'site became declared, so the element''s TEXT changed and the assertion stayed. A reader '
  'looking for a -1 in plan() on this account will not find one. ⚠ PINNED AS A NAMED SET RATHER '
  'THAN COUNTED, for §4.6''s reason: a count lets one carrier be swapped for another silently. A '
  'NEW undeclared carrier reds here, and the string is then updated after a ruling, never '
  'widened to absorb it.');

select is(
  (select count(*)::int from authz_manifest_sites s
     join authz_manifest_permissions m on m.code = s.code where m.status = 're-keyed')::text
  || ' / ' ||
  (select count(*)::int from authz_manifest_permissions m join pg_policies pol on true
    where m.status = 're-keyed'
      and pg_temp.reaches_code('policy', pol.schemaname, pol.tablename, pol.policyname, m.code))::text
  || ' / ' || (select count(*)::int from t410_carriers)::text,
  '13 / 8 / 4',
  '8.6 CARDINALITY CONTROL for 8.1, 8.4 and 8.5, AS A TRIPLE: 13 declared sites on re-keyed '
  'rows, 8 catalog policies that reach a re-keyed code, 4 literal carriers. ⚠ 12 -> 13 on '
  '2026-09-07: `app.current_professional_read_organizations` became a declared site (8.5). The '
  'second and third figures did NOT move — it is a function, not a policy, and it was already '
  'one of the four carriers. ⛔ Each of the three '
  'arms above is satisfied by an EMPTY domain — 8.1 by a manifest whose sites never join, 8.4 by '
  'a `reaches_code` that finds no policy, 8.5 by a carrier table that failed to build. Asserted '
  'as one string so the three cannot drift apart quietly. ⚠ 12 vs 8 is NOT an inconsistency: the '
  'declared 12 include 4 FUNCTION sites, which 8.4''s policy-only domain does not count. These '
  'numbers RISE with each AE5 re-key; moving them is how an increment is recorded.');

-- ⛔⛔ § 8.7 / § 8.8 — THE TWO AXES A SITE-ONLY CLOSURE CANNOT SEE (ADR 0193 D5 / D7, PO ruling
-- 2026-09-07). § 8.1/§ 8.4 close the POLICY axis in both directions. Two other kinds of catalog
-- object touch a re-keyed permission and neither was gated by anything before this date:
--   * a SECURITY DEFINER writer of a declared site's relation. Where the policy is reachable it
--     is a second door beside the re-keyed one; where the policy is UNREACHABLE (measured:
--     `form_item_validations`, `authenticated` holds SELECT only) it is the ONLY door, and the
--     permission was inert for the whole table until 20261003007350 re-keyed it. Recording that
--     split in a `_comment` is precisely the shape QA has blocked on every time — a claim about
--     a measurement that no gate can contradict — so it is DATA and this is its arm.
--   * a CONSUMER of the domain authorizer that is deliberately NOT an enforcement site. The
--     Rule 11 audit registry `app._audit_access_authorized` calls
--     `app.can_read_professional_profile` to decide what to RECORD, never what to permit.
--     ⛔ Declaring it a site would make § 8.1/§ 8.4 measure a fiction; leaving it undeclared
--     leaves the consumer axis open. It is a third state and it is declared as one.
create or replace function pg_temp.writes_relation(p_body text, p_schema text, p_relation text)
returns boolean language sql immutable as $$
  select p_body ~ ('(insert into|update|delete from)[[:space:]]+(' || p_schema || '\.)?'
                   || p_relation || '\M');
$$;

select is(
  (select coalesce(string_agg(v, '; ' order by v), '(none)') from (
     -- FORWARD: a DEFINER writer of a declared site's relation that the row does not declare.
     select distinct m.code || ' <- UNDECLARED DEFINER writer ' || n.nspname || '.' || p.proname
              || ' writes ' || s.site_relation as v
       from authz_manifest_permissions m
       join authz_manifest_sites s on s.code = m.code and s.site_kind = 'policy'
       -- ⛔ WRITE-CAPABLE POLICY SITES ONLY, AND THE BOUND IS DERIVED FROM THE CATALOG, NOT
       -- HAND-LISTED. A DEFINER *writer* can only be a second door beside a policy that gates
       -- WRITES; beside a SELECT policy it is not a backstop for anything. Without this the
       -- arm reported every DEFINER writer of `professional_profiles` as an undeclared writer
       -- behind `professional_profiles_select` — measured, and it is a category error, not a
       -- finding.
       join pg_policies wp on wp.schemaname = s.site_schema and wp.tablename = s.site_relation
                          and wp.policyname = s.site_name
                          and wp.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
       join pg_proc p on p.prosecdef
       join pg_namespace n on n.oid = p.pronamespace and n.nspname in ('app', 'public')
      where m.status = 're-keyed'
        and pg_temp.writes_relation(coalesce(pg_temp.fn_body(n.nspname, p.proname), ''),
                                    s.site_schema, s.site_relation)
        and not exists (select 1 from authz_manifest_definer_surface d
                         where d.code = m.code and d.fn_schema = n.nspname and d.fn_name = p.proname)
     union all
     -- REVERSE 1: a declared entry that is not a SECURITY DEFINER function in the catalog.
     select d.code || ' -> ' || d.fn_schema || '.' || d.fn_name
              || ' is NOT a SECURITY DEFINER function in the catalog'
       from authz_manifest_definer_surface d
      where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = d.fn_schema and p.proname = d.fn_name and p.prosecdef)
     union all
     -- REVERSE 2: a declared `writes` relation the body does not actually write.
     select d.code || ' -> ' || d.fn_schema || '.' || d.fn_name || ' does not write ' || w
       from authz_manifest_definer_surface d, unnest(d.writes) w
      where pg_temp.fn_body(d.fn_schema, d.fn_name) is not null
        and not pg_temp.writes_relation(pg_temp.fn_body(d.fn_schema, d.fn_name), 'public', w)
     union all
     -- REVERSE 3: the declared gate disagrees with the body. `gate: null` is a CLAIM that the
     -- door has no authority check at all, and it is checked as one.
     select d.code || ' -> ' || d.fn_schema || '.' || d.fn_name || ' declares gate '
              || coalesce(d.gate, 'null') || ' which the body contradicts'
       from authz_manifest_definer_surface d
      where pg_temp.fn_body(d.fn_schema, d.fn_name) is not null
        and ((d.gate is not null
              and position(d.gate || '(' in pg_temp.fn_body(d.fn_schema, d.fn_name)) = 0)
          or (d.gate is null
              and pg_temp.fn_body(d.fn_schema, d.fn_name)
                  ~ '(app\.is_staff_admin_of|app\.is_tenancy_admin_of|app\.can_edit_commission_forms)\('))
     union all
     -- REVERSE 4: carriesCode disagrees. The needle carries its quotes and uses `position`,
     -- for §4's reason: permission codes contain `.`, which a regex reads as "any character".
     select d.code || ' -> ' || d.fn_schema || '.' || d.fn_name || ' carriesCode='
              || d.carries_code::text || ' disagrees with the body'
       from authz_manifest_definer_surface d
      where pg_temp.fn_body(d.fn_schema, d.fn_name) is not null
        and d.carries_code
            <> (position('''' || d.code || '''' in pg_temp.fn_body(d.fn_schema, d.fn_name)) > 0)
     union all
     -- REVERSE 5: the declared grant posture disagrees with the ACL. "A correct door nothing
     -- can reach" is only visible if the posture is declared AND checked.
     select d.code || ' -> ' || d.fn_schema || '.' || d.fn_name || ' executableByAuthenticated='
              || d.exec_authenticated::text || ' disagrees with the ACL'
       from authz_manifest_definer_surface d
      where exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = d.fn_schema and p.proname = d.fn_name)
        and d.exec_authenticated <> (
              select bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = d.fn_schema and p.proname = d.fn_name)
   ) t),
  '(none)',
  '8.7 ⭐⭐ THE DEFINER-WRITER CLOSURE, BOTH DIRECTIONS. Forward: every SECURITY DEFINER function '
  'that writes a relation named by a re-keyed row''s declared WRITE-CAPABLE POLICY site (cmd ALL '
  '/ INSERT / UPDATE / DELETE, read from `pg_policies`, never hand-listed) appears in that row''s '
  '`definerSurface`. Reverse: every declared entry exists in the catalog as a DEFINER function, '
  'writes what it says it writes, carries the gate it says it carries (⛔ including `gate: null`, '
  'which is a MEASURED finding — a door with no authority check at all — and is checked as a '
  'claim, not treated as an omission), and has the grant posture it declares. ⛔ ONE DIRECTION '
  'WOULD NOT BE A CLOSURE: forward alone is satisfied by declaring extra functions, reverse alone '
  'by declaring none. ⚠ POPULATION, STATED BEFORE THE NUMBER (LEARN-009): 8 DEFINER writers over '
  'the nine-table form family, of which the forward arm REQUIRES the 4 that write one of the six '
  'declared site relations; the other 4 (form_block_library x3, the matrix axes x1) are declared '
  'anyway because they are the same AE5 work list. ⛔ `docs/design/authz-ae43-staff-admin-'
  'permission-matrix.md`''s 22 is the wider READ-AND-WRITE population and is also correct — '
  'neither figure is a correction of the other (LEARN-079). ⭐ 1 OF THE 8 IS RE-KEYED as of '
  '20261003007350 (`public.set_item_validations`, gate `app.can_edit_commission_forms`); the '
  'other 7 are AE5''s and this arm is what stops AE5 copying the split eleven times. ⚠ A re-keyed '
  'DEFINER door lives on THIS axis, not in `enforcementSites`: the site axis of this row is the '
  'POLICY axis (§ 8.4''s closure is policy-only and says so), and one door has one home '
  '(ADR 0186). Its behavioural proof is 409 § 2.6f/§ 2.10e, not this file.');

select is(
  (select coalesce(string_agg(v, '; ' order by v), '(none)') from (
     -- FORWARD 1: a FUNCTION that calls a re-keyed row's authorizer and is in none of the three
     -- declared classes (site / definer surface / non-enforcement consumer).
     select m.code || ' <- UNCLASSIFIED consumer FN ' || n.nspname || '.' || p.proname as v
       from authz_manifest_permissions m
       join pg_proc p on true
       join pg_namespace n on n.oid = p.pronamespace
      where m.status = 're-keyed' and m.domain_authorizer is not null
        and n.nspname in ('app', 'authz', 'public')
        and n.nspname || '.' || p.proname <> m.domain_authorizer
        and position(m.domain_authorizer || '(' in
                     regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')) > 0
        and not exists (select 1 from authz_manifest_sites s
                         where s.code = m.code and s.site_kind = 'function'
                           and s.site_schema = n.nspname and s.site_name = p.proname)
        and not exists (select 1 from authz_manifest_definer_surface d
                         where d.code = m.code and d.fn_schema = n.nspname and d.fn_name = p.proname)
        and not exists (select 1 from authz_manifest_non_enforcement_consumers c
                         where c.code = m.code and c.fn_schema = n.nspname and c.fn_name = p.proname)
     union all
     -- FORWARD 2: a POLICY that calls the authorizer and is not a declared site.
     select m.code || ' <- UNCLASSIFIED consumer POL ' || pol.schemaname || '.' || pol.tablename
              || ' / ' || pol.policyname
       from authz_manifest_permissions m
       join pg_policies pol on true
      where m.status = 're-keyed' and m.domain_authorizer is not null
        and position(m.domain_authorizer || '(' in
                     coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) > 0
        and not exists (select 1 from authz_manifest_sites s
                         where s.code = m.code and s.site_kind = 'policy'
                           and s.site_schema = pol.schemaname and s.site_relation = pol.tablename
                           and s.site_name = pol.policyname)
     union all
     -- REVERSE: a declared non-enforcement consumer that does not actually consume the
     -- authorizer. Without this the field is a place to park any name at all.
     select c.code || ' -> declared nonEnforcementConsumer ' || c.fn_schema || '.' || c.fn_name
              || ' does not call the authorizer'
       from authz_manifest_non_enforcement_consumers c
       join authz_manifest_permissions m on m.code = c.code
      where m.domain_authorizer is null
         or position(m.domain_authorizer || '(' in
                     coalesce(pg_temp.fn_body(c.fn_schema, c.fn_name), '')) = 0
   ) t),
  '(none)',
  '8.8 ⭐⭐ THE AUTHORIZER-CONSUMER PARTITION, CLOSED IN BOTH DIRECTIONS. Every catalog object '
  'that calls a re-keyed row''s domain authorizer is EXACTLY ONE OF: a declared enforcement site, '
  'a declared `definerSurface` door, or a declared `nonEnforcementConsumer` — and every declared '
  'non-enforcement consumer really does call it. ⛔ THE THIRD CLASS IS THE POINT. Before '
  '2026-09-07 `app._audit_access_authorized` was the FOURTH consumer of '
  '`app.can_read_professional_profile` and appeared nowhere in the tree: not a site (it decides '
  'what the audit trail RECORDS, never what a caller may read — Architecture Rule 11), and with '
  'no other home it was simply invisible. Adding it to `enforcementSites` to make it visible '
  'would have made § 8.1/§ 8.4 measure a logging predicate as a door. ⚠ MEASURED TODAY, 14 '
  'consumers over the three authorizers: 12 declared sites, `public.set_item_validations` on the '
  'definerSurface axis, and `app._audit_access_authorized` here. ⛔ THE NEXT unrecorded consumer '
  'REDS instead of being re-discovered by a reviewer, which is the whole difference between this '
  'arm and the paragraph it replaces.');

-- ============================================================================
-- §9 — WHAT THIS FILE DOES NOT DO. Recorded IN the gate, because a limitation that lives only
-- in a report is lost by the next reader of the green.
--
--   * It says NOTHING about `axes.resourceLifecycle`. There is no catalog column encoding a
--     resource lifecycle, so those values are bound to nothing here and are asserted only for
--     internal consistency by lint. They are DERIVED (from Axis 6b's vocabulary and from
--     Architecture Rules 3/4/5), NOT PO-approved — the manifest's `lifecycleDerivation` block
--     states the derivation so a reader can check it. ⛔ Do not cite this suite as evidence
--     for a lifecycle claim.
--   * It does not prove a site ENFORCES anything BEHAVIOURALLY. §8 raised the structural claim
--     from "the declared call is present" to "the site reaches its permission code in the live
--     catalog, in both directions" — but that is still a fact about the SQL. `pg_policies`
--     holding a policy named X, and that policy reaching a code, do not make a principal's
--     UPDATE succeed or fail. The behavioural differential is pgTAP 409's job (§2 for
--     commission.forms.edit, on WRITES, with the permissive-sibling control), and the standing
--     lesson is that all four DB gates can be true while the page still 404s.
--   * §8 does not check the site axis for `pending-rekey` rows. It cannot: those 40 rows declare
--     ZERO sites and a reviewed `callGraphBoundary` instead, and §6.4 is the fence that keeps
--     that label off any row with enumerated sites. Their sites become checkable at the moment
--     they are declared, which is the moment the row flips.
--   * `carriers_of` reads `prosrc` only. A permission code carried in a policy QUAL rather
--     than a function body would not be seen. That shape does not exist today (measured: zero
--     carriers anywhere) and layer 3 puts the code inside an authorizer FUNCTION by
--     construction (ADR 0176 D2), but the bound is stated rather than assumed away.
--   * It does not re-assert 401 § 19. § 19.1/§ 19.2 (manifest-sourced) prove every code's
--     legacy gate exists and that the 43 partition into six classes; § 19.2b/§ 19.4/§ 19.5/
--     § 19.6 prove body identity and the resolver's per-permission answers. Those are
--     different claims and they stay where they are.
-- ============================================================================

select * from finish();
rollback;
