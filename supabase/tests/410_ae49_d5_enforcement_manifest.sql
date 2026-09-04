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
-- RUN SHAPE: `Files=2, Tests=41` (40 here + 00_setup.sql's one).
-- §1 4 · §2 6 · §3 7 · §4 6 · §5 3 · §6 4 · §7 4 · §8 6 = 40.
-- ⚠ 34 -> 40: § 8, the SITE-AXIS CLOSURE, added to close
-- FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE after BUG-AE49-D6-REKEY-INCOMPLETE shipped through
-- every green gate in this file. Read § 8's header before trusting anything below about sites.
-- ⚠ 32 -> 33 at authoring time: § 3.7 (the AUTHORIZER-composition arm) was added after § 3.5
-- red on the re-keyed catalog and the authority turned out to have MOVED rather than vanished.
-- ⚠ 33 -> 34: § 4.6, the residual-legacy-authority disclosure imposed as a CONDITION by the
-- lead on the ruling that a re-keyed policy calls only its authorizer. Without it § 4.5's
-- `re-keyed: 3` reads as "3 permissions fully on layer 3", which is false for all three.

begin;
select plan(40);

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

select is((select count(*)::int from authz_manifest_sites), 12,
  '1.4 CARDINALITY CONTROL for §3 AND §8: exactly 12 enforcement sites are declared (6 policies '
  'for commission.forms.edit, 3 RPCs for org.professionals.create, 2 policies + 1 RPC for '
  'org.professionals.read). §3 asserts each EXISTS and §8 asserts each ENFORCES; without this '
  'count, deleting site rows would shrink both domains and every remaining assertion would '
  'still be green. ⚠ 10 -> 12 at 20261003007340: the two `form_item_options` / '
  '`form_item_validations` write policies were named by the PO-approved matrix, were NOT '
  're-keyed, and were absent from this list — BUG-AE49-D6-REKEY-INCOMPLETE. ⛔ Raising this '
  'number is how a re-key is RECORDED; it is never how a §8 red is silenced.');

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
  20,
  '3.6 CARDINALITY CONTROL for 3.5 AND 3.7: 12 (site, authority) pairs plus 8 (authorizer, '
  'authority) pairs were checked. Both are "violations = 0" assertions over an UNNEST — '
  'emptying `composedWith` everywhere would satisfy both perfectly while checking nothing. '
  '⚠ The 8 authorizer pairs are 2 for can_edit_commission_forms, 2 for '
  'can_create_professional, 4 for can_read_professional_profile.');

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
-- §6 — THE HARD-DENY VOCABULARY IS ALIVE, AND AN EMPTY DEPTH-1 LIST IS FALSIFIABLE.
--
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
-- ⛔ The review's phrase "depth 2 on both arms" holds for ONE arm of ONE row. Raising the
-- search by a single hop would catch that path and leave the other five unmeasured — the
-- partial fix that reads as a complete one. The transitive measurement plus a positive
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

select is(
  (select coalesce(string_agg(m.code || ' at ' || s.site_name || ' composes ' || v.gate,
                              '; ' order by m.code, s.site_name), '(none)')
     from authz_manifest_permissions m
     join authz_manifest_sites s on s.code = m.code
     cross join authz_manifest_hard_deny_vocab v
    where m.hard_deny_provenance = 'measured-depth1-at-sites-and-authorizer'
      and cardinality(m.hard_deny_classes) = 0
      and v.gate is not null
      and (position(v.gate || '(' in
             case s.site_kind
               when 'policy' then pg_temp.policy_body(s.site_schema, s.site_relation, s.site_name)
               else               coalesce(pg_temp.fn_body(s.site_schema, s.site_name), '')
             end) > 0
           -- ⭐ THE AUTHORIZER BODY IS SEARCHED TOO. The re-key MOVED authority off the
           -- policies and into the authorizer; a hard deny added there would be invisible to
           -- a site-only search, and this row would keep claiming a measured zero.
           or position(v.gate || '(' in
                coalesce(pg_temp.fn_body(split_part(coalesce(m.domain_authorizer, '.'), '.', 1),
                                         split_part(coalesce(m.domain_authorizer, '.'), '.', 2)), '')) > 0)),
  '(none)',
  '6.2 ⭐⭐ NO HARD-DENY GATE IS INVOKED **DIRECTLY** AT THE DECLARED SITES OR IN THE '
  'AUTHORIZER BODY — DEPTH 1, STATED AS DEPTH 1. Three rows declare '
  '`measured-depth1-at-sites-and-authorizer` with ZERO classes, and an empty list looks '
  'exactly like a lazy one; this asserts the depth-1 measurement and NOTHING about the '
  'composed-call closure beneath it. ⛔ THE ZERO IS A SEARCH HORIZON, NOT AN ABSENCE: '
  '`principal_inactive` (app.is_active) is enforced on all three of these rows at depth 2-4, '
  'and org.professionals.read reaches `respondent_exclusion` at depth 5 — measured on the '
  'live catalog 2026-09-03; the per-row paths are in this section header. This arm cannot see '
  'any of them and is not meant to. The bound is DISCLOSED here, not repaired. ⛔ The end '
  'state is the TRANSITIVE measurement plus a positive control that plants a vocabulary gate '
  'and requires 6.2 to NAME it, landing together with the M7 fix in '
  'FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL — neither half buys anything alone. ⛔ Still live as '
  'a gate at its own depth: if a re-key composes app.is_case_excluded DIRECTLY into a form '
  'policy or its authorizer, this reds and the row must record the class — the finding it '
  'preserves is that the recusal / respondent hard denies live at the CASE-family sites, '
  'all of which are still pending-rekey.');

select ok(
  (select count(*) from authz_manifest_permissions m join authz_manifest_sites s on s.code = m.code
    where m.hard_deny_provenance = 'measured-depth1-at-sites-and-authorizer') > 0
  and (select count(*) from authz_manifest_hard_deny_vocab where gate is not null) > 0,
  '6.3 CARDINALITY CONTROL for 6.2: both sides of its cross join are non-empty. 6.2 is a '
  'cross product; either side going empty makes it assert nothing while still reporting '
  '"(none)". ⚠ THIS IS A CARDINALITY CONTROL AND NOT A DISCRIMINATION ONE — it proves the '
  'cross join has rows, never that 6.2''s position() predicate can evaluate true. The '
  'positive control that would close that gap is (b) in '
  'FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL; do not read this arm as supplying it.');

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
  'org.professionals.read => app.current_professional_read_organizations [UNDECLARED]',
  '8.5 ⭐⭐ EVERY LITERAL CARRIER IS CLASSIFIED, BY NAME — the follow-up''s "every catalog object '
  'carrying that literal appears in exactly one row" direction. Each carrier is the row''s '
  'AUTHORIZER, a DECLARED function site, or UNDECLARED. ⛔ THE ONE `UNDECLARED` IS A DISCLOSURE, '
  'NOT AN APPROVAL. `app.current_professional_read_organizations` acquired the '
  '`org.professionals.read` literal at 20261003007320 as a deliberate SECOND site (ADR 0182; '
  '409 §1.1 rules the duplication safe as a subset argument, 413 §2/§5 measure it), yet no '
  'manifest row names it. Closing that is either a new `enforcementSites` entry or a reviewed '
  'exclusion, and it is the PO''s call, not this file''s. ⚠ PINNED AS A NAMED SET RATHER THAN '
  'COUNTED, for §4.6''s reason: a count lets one carrier be swapped for another silently. A NEW '
  'undeclared carrier reds here, and so does declaring this one — the second red is the gap '
  'being CLOSED and the string is then updated, never widened to absorb a third.');

select is(
  (select count(*)::int from authz_manifest_sites s
     join authz_manifest_permissions m on m.code = s.code where m.status = 're-keyed')::text
  || ' / ' ||
  (select count(*)::int from authz_manifest_permissions m join pg_policies pol on true
    where m.status = 're-keyed'
      and pg_temp.reaches_code('policy', pol.schemaname, pol.tablename, pol.policyname, m.code))::text
  || ' / ' || (select count(*)::int from t410_carriers)::text,
  '12 / 8 / 4',
  '8.6 CARDINALITY CONTROL for 8.1, 8.4 and 8.5, AS A TRIPLE: 12 declared sites on re-keyed '
  'rows, 8 catalog policies that reach a re-keyed code, 4 literal carriers. ⛔ Each of the three '
  'arms above is satisfied by an EMPTY domain — 8.1 by a manifest whose sites never join, 8.4 by '
  'a `reaches_code` that finds no policy, 8.5 by a carrier table that failed to build. Asserted '
  'as one string so the three cannot drift apart quietly. ⚠ 12 vs 8 is NOT an inconsistency: the '
  'declared 12 include 4 FUNCTION sites, which 8.4''s policy-only domain does not count. These '
  'numbers RISE with each AE5 re-key; moving them is how an increment is recorded.');

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
