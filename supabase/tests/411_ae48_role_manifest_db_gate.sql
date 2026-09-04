-- 411 — AE4.9 "do now" item (d) / audit finding IA-F7: the DB half of the ROLE_MANIFEST
-- ↔ authz.roles binding, split out of a vitest UNIT test that used to shell out to
-- Docker (`docker exec … psql`) to read this same catalog — which made `npm run test`
-- require the local Supabase stack. Subject: `authz.roles` (401's §3), read-only here.
--
-- WHY THIS FILE EXISTS RATHER THAN STAYING IN role-catalog.test.ts. `ROLE_MANIFEST`
-- (src/lib/role/role-catalog.ts) is TypeScript; pgTAP is SQL; neither side can import
-- the other's source. `role-catalog.test.ts` keeps every assertion provable from the TS
-- objects alone — no DB, no Docker. This file carries the half that needs the live
-- catalog: is `ROLE_MANIFEST` exactly `authz.roles`' session-selectable half, with
-- matching `allowed_scope_kind`?
--
-- THE CROSS-LANGUAGE SEAM — READ BEFORE EDITING §1. §1 below is a COMMITTED, literal
-- (code, scope_kind) snapshot of `ROLE_MANIFEST`, between the `MANIFEST-SNAPSHOT-BEGIN`
-- / `MANIFEST-SNAPSHOT-END` marker comments. It is the machine-checkable stand-in both
-- sides key on, and it is read TWICE:
--   * `role-catalog.test.ts` reads THIS FILE as plain text (`fs.readFileSync`, no DB)
--     and asserts the marked block equals `ROLE_MANIFEST` — edit one without the other
--     and that test reds, with no `supabase start` needed to see it.
--   * §3/§4/§5 below assert that SAME block against the live `authz.roles` table — edit
--     a migration's role seed without updating the block and THIS suite reds.
-- Chained, the two hops re-prove the original single-test claim (TS manifest agrees with
-- the live catalog) without either hop acquiring the other's dependency.
--
-- ⛔⛔ KEEP THE MARKER COMMENTS AND THE `('code', 'scope_kind')` ROW SHAPE EXACTLY.
-- `role-catalog.test.ts` parses this file with a regex keyed on those two markers and on
-- single-quoted `('x', 'y')` pairs. Reformatting the block (multi-line rows, double
-- quotes, trailing commentary inside the marker span) breaks that parser. The vitest
-- side guards against a parse that silently finds NOTHING (throws on zero rows), but a
-- parse that finds the WRONG rows would not be caught by that guard — do not rely on it,
-- keep the shape.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` and performs no mutation: its
-- only subject is the catalog table `authz.roles`, seeded once by migration and
-- independent of the org/commission fixture bootstrap builds. Everything here is a
-- read, and the transaction rolls back regardless.
--
-- RUN SHAPE: `Files=2, Tests=9` (8 here + 00_setup.sql's one).
-- ⚠ 7 -> 8 at the Gate AE4 review (F-MAJOR-4b): §5.1 was re-pointed at the DECLARED domain
-- vocabulary — the one grain §3/§4 do not entail — and gained the discrimination control §5.2
-- that a subtraction-built expectation needs. See §5's header for the dependency proof.

begin;
select plan(8);

-- ============================================================================
-- §1 — the committed manifest snapshot. ALSO parsed as plain text by
-- src/lib/role/role-catalog.test.ts (see that file's module doc comment). Keep this
-- block in sync with src/lib/role/role-catalog.ts's ROLE_MANIFEST BY HAND — both drift
-- directions are gated (there, and by §3/§4/§5 below), but nothing enforces the edit
-- itself; a code review noticing "ROLE_MANIFEST changed, did 411 move too" is still the
-- first line of defense.
-- ============================================================================
-- MANIFEST-SNAPSHOT-BEGIN
create temp table manifest_snapshot (code text, scope_kind text) on commit drop;
insert into manifest_snapshot (code, scope_kind) values
  ('platform_admin', 'none'),
  ('org_admin', 'organization'),
  ('hospital_admin', 'hospital'),
  ('nsp_org_admin', 'organization'),
  ('staff_admin', 'commission'),
  ('staff', 'commission'),
  ('nsp_coordinator', 'hospital'),
  ('pqs_member', 'hospital'),
  ('technical_director', 'hospital'),
  ('technical_director_deputy', 'hospital'),
  ('quality_reviewer', 'hospital');
-- MANIFEST-SNAPSHOT-END

select is((select count(*)::int from manifest_snapshot), 11,
  '1.1 FIXTURE CONTROL: the committed snapshot carries all eleven ROLE_MANIFEST rows — '
  'a truncated paste here would make §3/§4 pass by vacuity (comparing an empty or '
  'partial set instead of the real one).');

-- ============================================================================
-- §2 — DISCRIMINATION CONTROL, ported from role-catalog.test.ts's own: authz.roles
-- actually distinguishes selectable from not, so §3's set-equality assertion cannot be
-- vacuously true against an empty or all-one-value catalog. The original control
-- existed to catch a text-parsing boolean-cast bug specific to the retired
-- `docker exec … psql -tAc` read path; this SQL-native read cannot reproduce that
-- specific bug, but the vacuity risk it guards — an accidentally all-true or all-false
-- catalog — is a property of the DATA, not of the old read mechanism, so the control is
-- kept.
-- ============================================================================
select cmp_ok(
  (select count(*)::int from authz.roles where session_selectable), '>', 0,
  '2.1 at least one authz.roles row is session_selectable (else §3''s RHS is empty)');

select cmp_ok(
  (select count(*)::int from authz.roles),
  '>',
  (select count(*)::int from authz.roles where session_selectable),
  '2.2 the catalog holds at least one NON-selectable row too (administrativo) — so §3 '
  'compares against a genuine subset of authz.roles, not the whole table');

select ok(
  exists(select 1 from authz.roles where not session_selectable),
  '2.3 …and at least one such row is directly OBSERVABLE, not merely inferable from '
  'the 2.2 arithmetic — restates the same fact as an EXISTS, mirroring the retired '
  'role-catalog.test.ts discrimination control''s own third (and independently '
  'necessary, per its comment) assertion rather than dropping it as redundant');

-- ============================================================================
-- §3 — the manifest snapshot is EXACTLY authz.roles' session-selectable half: no code
-- missing, none extra (`administrativo`, the one false row, is correctly absent).
-- ============================================================================
select is(
  (select array_agg(code order by code) from manifest_snapshot),
  (select array_agg(code order by code) from authz.roles where session_selectable),
  '3.1 the snapshot''s code set equals { code : authz.roles.session_selectable }');

-- ============================================================================
-- §4 — every snapshot row's scope_kind matches authz.roles.allowed_scope_kind for that
-- SAME code.
-- ============================================================================
select is(
  (select count(*)::int
     from manifest_snapshot m
     join authz.roles r on r.code = m.code
    where r.allowed_scope_kind::text = m.scope_kind),
  11,
  '4.1 every snapshot row''s scope_kind matches authz.roles.allowed_scope_kind for that '
  'code — an 11/11 JOIN COUNT rather than a boolean, so a code that fails to join at '
  'all (dropped from the catalog, or renamed) is distinguishable from one that joins '
  'with a mismatched scope_kind');

-- ============================================================================
-- §5 — the scope_kind VOCABULARY, at the one grain §3/§4 cannot reach.
--
-- ⛔⛔ WHAT §5.1 USED TO ASSERT, AND WHY IT WAS REPLACED RATHER THAN KEPT. It read:
--
--     count(*) from manifest_snapshot
--      where scope_kind not in (select distinct allowed_scope_kind::text from authz.roles)  = 0
--
-- with the justification "§4 only checks the codes actually present in both sides".
-- ⛔ THAT JUSTIFICATION IS FACTUALLY FALSE AND THE ASSERTION COULD NOT FAIL ALONE. §1.1 pins
-- |manifest_snapshot| = 11 and §4.1 demands ELEVEN joined rows with equal scope_kind, so if
-- §4.1 passes then EVERY snapshot code is present in both sides and every snapshot scope_kind
-- is, by construction, a member of `select distinct allowed_scope_kind`. §5.1 was therefore
-- entailed by §4.1: green whenever §4.1 was green, and red only when §4.1 was already red.
-- ⭐ MEASURED, not only argued: typo `pqs_member`'s kind to `hospitaI` and §4.1 goes 11 -> 10
-- (red) while the old §5.1 goes 0 -> 1 (red) — the two move TOGETHER, always. There is no
-- state in which the old §5.1 was the assertion that caught anything.
-- (Gate AE4 review, F-MAJOR-4b — the only assertion in the six AE4 suites provably incapable
-- of failing alone, inside a phase whose subject is gates that cannot fail.)
--
-- ⭐ WHAT §5 CAN ASK THAT §3/§4 CANNOT. §3.1 + §4.1 together fully determine the (code,
-- scope_kind) pairs of the session-selectable half, so EVERY claim about that half is
-- entailed. The vocabulary claim survives only if it is asked of the DECLARED type — the
-- `authz.scope_kind` domain's CHECK — because nothing in §3/§4 constrains which labels the
-- domain declares. Today it declares FIVE and the manifest exercises FOUR; the fifth,
-- `capability_plane`, is `administrativo`'s, and `administrativo` is precisely the row §2/§3
-- exist to keep OUT of the manifest. So §5.1 is now "the manifest exercises exactly the
-- declared vocabulary minus the capability plane", which reds when a sixth label is declared
-- while §4.1 stays 11/11 — the independent failure the old form did not have.
-- ⚠ WHEN IT REDS BECAUSE AE5 DECLARED A NEW SCOPE KIND, that is the assertion working: rule
-- on whether the session-selectable manifest must cover the new plane, then move the name.
-- Do not delete the line.
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

select is(
  (select array_agg(distinct scope_kind order by scope_kind) from manifest_snapshot),
  (select array_agg(k order by k) from unnest(pg_temp.declared_scope_kinds()) k
    where k <> 'capability_plane'),
  '5.1 the manifest''s scope-kind vocabulary is EXACTLY the vocabulary `authz.scope_kind` '
  'DECLARES, minus the capability plane. ⛔ Asked of the DOMAIN CHECK and not of '
  '`select distinct allowed_scope_kind` — the latter is entailed by §4.1 and cannot fail '
  'alone (see this section''s header). A label added to the domain reds this while §4.1 stays '
  '11/11, which is the whole reason the assertion exists.');

select is(
  ('capability_plane' = any(pg_temp.declared_scope_kinds()))::text
    || '/' || coalesce((select string_agg(r.code, ',' order by r.code) from authz.roles r
                         where r.allowed_scope_kind::text = 'capability_plane'), '(none)')
    || '/' || coalesce((select string_agg(m.code, ',' order by m.code) from manifest_snapshot m
                         where m.scope_kind = 'capability_plane'), '(none)'),
  'true/administrativo/(none)',
  '5.2 ⭐ DISCRIMINATION CONTROL for 5.1, in three parts, because 5.1''s expected side is '
  'built by SUBTRACTING a name and a probe that never saw that name would pass 5.1 while '
  'measuring nothing. (a) `capability_plane` IS in what the probe reads, so '
  '`declared_scope_kinds()` is not silently truncated; (b) it is held by exactly '
  '`administrativo` in the live catalog, which is WHY it is subtracted — the capability plane '
  'is not a session role scope (ADR 0061); (c) no manifest row uses it, so the subtraction is '
  'not hiding a snapshot row. ⛔ If a SECOND role ever takes `capability_plane` this reds: '
  'rule on it, do not widen the string.');

select * from finish();
rollback;
