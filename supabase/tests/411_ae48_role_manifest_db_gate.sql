-- 411 — AE4.9 "do now" item (d) / audit finding IA-F7: the DB half of the ROLE_MANIFEST
-- ↔ authz.roles binding, split out of a vitest UNIT test that used to shell out to
-- Docker (`docker exec … psql`) to read this same catalog — which made `npm run test`
-- require the local Supabase stack. Subject: `authz.roles` (401's §3), read-only here.
--
-- ⭐⭐ THE SNAPSHOT IS NO LONGER HAND-TYPED (ADR 0207 D4, unit AE5-ROLE-CATALOG-COMPAT).
-- §1 used to be ELEVEN ROWS TYPED BY HAND between `MANIFEST-SNAPSHOT-BEGIN`/`END` markers,
-- and this file's own comment admitted what that cost: *"Keep this block in sync with
-- ROLE_MANIFEST BY HAND — both drift directions are gated, but nothing enforces the edit
-- itself; a code review noticing 'ROLE_MANIFEST changed, did 411 move too' is still the
-- first line of defense."* A human noticing is not a gate. The rows are now a GENERATED,
-- COMMITTED artifact — `supabase/tests/vectors/role_manifest.psql`, written by
-- `scripts/gen-role-manifest.mjs --write` from the LIVE catalog — and the hand-edit step
-- is gone.
--
-- ⛔⛔ TWO ARMS, AND NEITHER IS THE VERDICT ALONE (ADR 0197 D4):
--   artifact == the TypeScript ROLE_MANIFEST  -> gate 19 (`npm run lint:role-manifest`),
--                                                text only, never opens a database
--   artifact == the live `authz.roles`        -> THIS FILE, in `npm run test:db`
-- Chained, ROLE_MANIFEST agrees with the catalog, and each arm reds independently on its
-- own half of a drift: edit ROLE_MANIFEST without regenerating and gate 19 reds; change a
-- migration's role seed without regenerating and §2 here reds. ⛔ The absence of one arm's
-- verdict is NOT the other arm's coverage.
--
-- ⚠ THE PINNED SIDE IS READ FROM A COMMITTED FILE, NEVER RE-DERIVED. `\ir` includes bytes
-- that are in git. Deriving the "expected" side live in the same instant would compare the
-- catalog to itself and pass under every mutation (LEARN-084).
--
-- ⛔ WHAT THIS FILE CANNOT SEE, STATED SO A GREEN IS NOT OVER-READ. The artifact carries
-- only what BOTH sides can speak about. `label`, `branch`, `branchEmptyFallback` and the
-- manifest's ORDER (which IS the landing precedence) have no catalog twin — Postgres has
-- no opinion about pt-BR wording or about where a role lands — so nothing here asserts
-- them; `src/lib/role/role-catalog.test.ts` does.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` and performs no mutation to any
-- PERMANENT table: its only subject is the catalog table `authz.roles`, seeded once by
-- migration and independent of the org/commission fixture bootstrap builds. §2.2's
-- mutation is applied to a TEMP COPY, never to `authz.roles`, and everything rolls back.
--
-- RUN SHAPE: `Files=2, Tests=10` (9 here + 00_setup.sql's one).
-- ⚠ 7 -> 8 at the Gate AE4 review (F-MAJOR-4b); 8 -> 9 at AE5-ROLE-CATALOG-COMPAT, where
-- the old §2 lost its subject and was RE-CAST rather than deleted (see §2's header).

begin;
select plan(9);

-- ============================================================================
-- §0 — the GENERATED artifact, and the two literals that pin it.
--
-- ⚠ THE ANCHOR IS MIRRORED, NOT RE-DERIVED (ADR 0195: one home, a gated mirror). The
-- artifact's header carries `rows=` and `md5=`; the two literals below must equal them,
-- and `gen-role-manifest.mjs --check` reads THESE LINES — the ones pgTAP actually
-- asserts, never a comment restating them — so two comments cannot agree while the
-- assertion says otherwise.
-- ============================================================================
\ir vectors/role_manifest.psql

select is(
  (select count(*)::int from role_manifest_pin),
  11,
  '§ 0a ROWS PIN: the artifact holds exactly the 11 roles its anchor declares. ⛔ A role '
  'added or removed updates BOTH the artifact (via --write) and this literal; updating '
  'only one is the drift this pin exists to catch.');

-- ⚠ `code collate "C"` — CODE-POINT order, matching the generator's JavaScript sort. Under
-- the cluster's default collation Postgres orders `_` differently and the md5 of a
-- byte-identical set would disagree. The concatenation shape is the generator's `rowText`.
select is(
  (select md5(string_agg(
            code || '|' || scope_kind || '|' || session_selectable || '|' ||
            system_managed || '|' || state, '|' order by code collate "C"))
     from role_manifest_pin),
  'a6b2308068d4b0f3e59e3f74e4539245',
  '§ 0b CONTENT PIN: the artifact''s CONTENT, not merely its count. A role swapped for '
  'another keeps § 0a green and moves this.');

-- ============================================================================
-- §1 — the catalog side's cardinality, so §2 is not comparing against a shrunken table.
-- ============================================================================

select is(
  (select count(*)::int from authz.roles),
  11,
  '1.1 FIXTURE CONTROL: `authz.roles` itself holds eleven rows. ⚠ TWELVE until ADR 0207 D5 '
  'step 4 (migration 20261003007430) deleted `administrativo` — the capability plane is a '
  'PROVIDER, not a role, and the row its own seed comment called "NOT A ROLE" is gone.');

-- ============================================================================
-- §2 — THE BINDING: the artifact IS `authz.roles`.
--
-- ⛔⛔ WHAT §2.2 REPLACED, AND WHY IT WAS RE-CAST RATHER THAN DELETED. The old §2 was a
-- three-part discrimination control asserting that `authz.roles` DISTINGUISHES
-- session-selectable rows from non-selectable ones — "at least one row is selectable",
-- "the table holds at least one NON-selectable row too (administrativo)", "…and one is
-- directly observable". It existed because the old §3 compared the snapshot to a SUBSET
-- of the catalog (`where session_selectable`), and a catalog that was accidentally
-- all-true would have made that subset the whole table and the comparison vacuous.
--
-- ⭐ ADR 0207 D5 step 4 removed its subject: `administrativo` was the ONLY non-selectable
-- row, so all eleven survivors are `session_selectable = true` and no row can play the
-- control's part. ⛔ A retired assertion with no successor is a finding, not a deletion —
-- so the PROPERTY was kept and its mechanism replaced. The vacuity risk is no longer
-- subset-shaped at all (the artifact now pins the WHOLE catalog, not its selectable
-- half), and what remains is the plain risk that the comparison cannot report inequality:
-- a fingerprint expression that is broken, always-null, or comparing something to itself
-- satisfies §2.1 perfectly. §2.2 answers exactly that, by mutating a TEMP COPY of the
-- catalog and requiring the SAME expression to report a difference.
-- ============================================================================

create temp table roles_mutated on commit drop as
  select r.code,
         r.allowed_scope_kind::text as scope_kind,
         r.session_selectable,
         r.system_managed,
         r.state::text              as state
    from authz.roles r;

update roles_mutated set scope_kind = 'hospital' where code = 'staff_admin';

select is(
  (select string_agg(
            code || '|' || scope_kind || '|' || session_selectable || '|' ||
            system_managed || '|' || state, '|' order by code collate "C")
     from role_manifest_pin),
  (select string_agg(
            r.code || '|' || r.allowed_scope_kind::text || '|' || r.session_selectable || '|' ||
            r.system_managed || '|' || r.state::text, '|' order by r.code collate "C")
     from authz.roles r),
  '2.1 ⭐⭐ THE COMMITTED ARTIFACT EQUALS THE LIVE CATALOG, on all five columns at once — '
  'code, allowed_scope_kind, session_selectable, system_managed and state. Edit a '
  'migration''s role seed without re-running `gen-role-manifest.mjs --write` and this reds.');

select isnt(
  (select string_agg(
            code || '|' || scope_kind || '|' || session_selectable || '|' ||
            system_managed || '|' || state, '|' order by code collate "C")
     from role_manifest_pin),
  (select string_agg(
            code || '|' || scope_kind || '|' || session_selectable || '|' ||
            system_managed || '|' || state, '|' order by code collate "C")
     from roles_mutated),
  '2.2 ⭐⭐ DISCRIMINATION HALF, and the successor to the retired §2 (see this section''s '
  'header): the SAME fingerprint expression, run against a copy of the catalog with ONE '
  'scope_kind changed, reports a DIFFERENCE. ⛔ Without it, §2.1 is satisfied just as well '
  'by an expression that is always NULL, or that compares the artifact to itself — the '
  'shapes that make a binding gate green while binding nothing.');

select is(
  (select count(*)::int from roles_mutated m
     join authz.roles r on r.code = m.code
    where m.scope_kind is distinct from r.allowed_scope_kind::text),
  1,
  '2.3 ⛔ THE MUTATION LANDED, and landed on exactly ONE row. A mutation that did not fully '
  'apply reports GREEN downstream — if the UPDATE had matched nothing, §2.2 would be '
  'comparing two identical strings and would red for the right reason by accident; if it '
  'matched everything, §2.2 would pass while proving far less than it claims.');

-- ============================================================================
-- §3 — the SAME agreement re-asked as a JOIN COUNT, because the two failures are not
-- equally diagnosable. §2.1's fingerprint reds identically whether a code is MISSING or
-- merely MISMATCHED; an 11/11 join count separates them (a code that fails to join at all
-- — dropped from the catalog, or renamed — versus one that joins with different values).
-- ============================================================================

select is(
  (select count(*)::int
     from role_manifest_pin p
     join authz.roles r on r.code = p.code
    where r.allowed_scope_kind::text = p.scope_kind
      and r.session_selectable      = p.session_selectable
      and r.system_managed          = p.system_managed
      and r.state::text             = p.state),
  11,
  '3.1 every artifact row joins its catalog row and agrees on all four non-key columns — '
  'an 11/11 JOIN COUNT rather than a boolean, so "the code is gone" and "the code is here '
  'with different values" are distinguishable failures.');

-- ============================================================================
-- §4 — the scope_kind VOCABULARY, at the one grain §2/§3 cannot reach.
--
-- ⭐ WHAT §4 CAN ASK THAT §2/§3 CANNOT. §2.1 fully determines the (code, scope_kind, …)
-- tuples of the catalog, so EVERY claim about the rows is entailed. The vocabulary claim
-- survives only if it is asked of the DECLARED type — the `authz.scope_kind` domain's
-- CHECK — because nothing in §2/§3 constrains which labels the domain declares. A sixth
-- label could be declared while §2.1 stays green.
--
-- ⚠ THE SUBTRACTION IS GONE, AND THAT IS A DELIBERATE RE-CAST. This assertion read "the
-- manifest exercises exactly the declared vocabulary MINUS the capability plane", because
-- the domain declared FIVE labels and the manifest exercised FOUR. ADR 0207 D5 step 4
-- dropped `capability_plane` from the domain, so the subtraction would now remove a name
-- that is not there — a no-op that reads like a live exclusion. The two sides are simply
-- EQUAL now, and §4.2 is what proves the fifth label really left rather than merely
-- falling out of a filter.
-- ============================================================================

-- Reads the LIVE domain constraint, never a migration's text. ⚠ If `authz.scope_kind` is ever
-- redefined as an enum this returns NULL and BOTH assertions below red loudly rather than
-- passing empty — the failure is checkable, which is the point.
create or replace function pg_temp.declared_scope_kinds() returns text[]
language sql stable as $$
  select array_agg(m[1] order by m[1])
    from pg_constraint c,
         lateral regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''::text', 'g') m
   where c.contypid = 'authz.scope_kind'::regtype and c.contype = 'c';
$$;

-- Exercises the domain at RUNTIME rather than reading its text, so §4.2's third part is
-- independent of its first: a CHECK that no longer mentions the label and a CHECK that
-- mentions it but does not enforce it are different states, and only this one separates them.
create or replace function pg_temp.casts_capability_plane() returns text
language plpgsql as $$
begin
  perform 'capability_plane'::authz.scope_kind;
  return 'accepted';
exception when check_violation then
  return 'rejected';
end;
$$;

select is(
  (select array_agg(distinct scope_kind order by scope_kind) from role_manifest_pin),
  (select array_agg(k order by k) from unnest(pg_temp.declared_scope_kinds()) k),
  '4.1 the catalog''s scope-kind vocabulary is EXACTLY the vocabulary `authz.scope_kind` '
  'DECLARES. ⛔ Asked of the DOMAIN CHECK, not of `select distinct allowed_scope_kind` — '
  'the latter is entailed by §2.1 and could not fail alone (the defect F-MAJOR-4b found '
  'here). A label added to the domain reds this while §2.1 stays green, which is the whole '
  'reason the assertion exists. ⚠ WHEN IT REDS BECAUSE AE5 DECLARED A NEW SCOPE KIND, that '
  'is the assertion working: rule on whether the manifest must cover the new plane, then '
  'move the name. Do not delete the line.');

select is(
  ('capability_plane' = any(pg_temp.declared_scope_kinds()))::text
    || '/' || coalesce((select string_agg(r.code, ',' order by r.code) from authz.roles r
                         where r.allowed_scope_kind::text = 'capability_plane'), '(none)')
    || '/' || pg_temp.casts_capability_plane(),
  'false/(none)/rejected',
  '4.2 ⭐ THE CAPABILITY PLANE IS GONE FROM THE ROLE DOMAIN — the successor to the control '
  'that used to prove it was PRESENT. Its three parts are the same three, inverted by ADR '
  '0207 D1/D5 step 4: (a) the domain no longer DECLARES `capability_plane`; (b) no catalog '
  'row carries it — it was `administrativo`''s alone, and `administrativo` left '
  '`authz.roles` to become a capability PROVIDER; (c) the domain actually REJECTS the '
  'value at runtime, which is a different claim from (a) — a CHECK can name a label it '
  'fails to enforce, and only a real cast separates the two. ⛔ If this reds because a role '
  'took a capability-plane scope again, rule on it — do not widen the string.');

select * from finish();
rollback;
