-- 419 — the NON-EMPTY DEFINER `search_path` population, frozen as a name set that may only SHRINK.
--
-- Owed by ADR 0208 D5, which orders it by number, and by
-- `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`'s re-claused close condition (deliverable 1).
--
-- ⭐ WHAT THIS ASSERTS, AND WHY IT IS NOT `414`. ADR 0208 D4 rules `set search_path = ''` with a
-- schema-qualified body the SOLE forward convention for a new or touched SECURITY DEFINER; the
-- 865 remaining non-empty paths are frozen compatibility debt that **may not grow** (867 before
-- migration `20261003007410` converged two of them). `414` proves
-- every schema NAMED in such a path RESOLVES — a different claim, and neither is the other's
-- verdict. `414` is kept byte-unchanged; this file is the prospective half.
--
-- ⛔ THE RATCHET IS DIRECTIONAL, AND THAT IS THE WHOLE DESIGN:
--   live \ frozen  is a FINDING  -- a new (or re-emitted, still non-empty) DEFINER: § 1a
--   frozen \ live  is LEGAL      -- a member converged to the empty form: § 1c
-- A symmetric equality would red on exactly the change D4 asks for, which is how a ratchet
-- becomes a reason not to converge anything.
--
-- ⛔ THE SECOND HALF OF THE RATCHET IS NOT IN THIS FILE, AND A READER MUST KNOW THAT. Nothing
-- here stops someone adding a non-empty DEFINER and then RE-RUNNING the generator, which would
-- launder the addition into the frozen set and leave § 1a green. That door is held by gate 18
-- (`npm run lint:definer-freeze`), which resolves the artifact's git baseline and refuses any
-- diff that is not a pure deletion. Two arms, two failure modes:
--   forgot to regenerate  -> § 1a reds here
--   regenerated to hide it -> gate 18 reds there
--
-- ⚠ THE FROZEN SIDE IS READ FROM A COMMITTED FILE, NEVER RE-DERIVED. `\ir` includes a GENERATED
-- artifact whose bytes are in git. Deriving the "expected" side live in the same instant would
-- compare the catalog to itself and pass under every mutation (LEARN-084).
--
-- ⚠ NO `test_helpers.bootstrap()`, no fixture, no tenancy — pg_proc and pg_namespace only, so
-- this suite is invariant to seed scale and to the AE4 perf fixture. Same posture as `414`.
--
-- ⚠ `# Looks like you planned 10 tests but ran 7` is EXPECTED and is not a failure: pgTAP's
-- internal counter unwinds with each `rollback to savepoint` while the TAP stream, which
-- pg_prove actually parses, is already emitted. Assertions live outside the savepoints too, so
-- the degenerate `# No tests run!` shape does not arise.
--
-- RUN SHAPE: `Files=2, Tests=11` (10 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a
-- count mismatch.

begin;
select plan(10);

-- ============================================================================
-- § 0 — THE DOMAIN. Spliced BY TEXT from `scripts/definer-search-path-census.sql`; gate 18
-- compares the two copies byte-for-byte, so the generator's idea of the population and this
-- gate's idea of it cannot drift apart in the safe direction.
-- ⛔ Edit the census file, then re-splice. Editing here alone REDS gate 18.
-- ============================================================================
create temp view v419_domain as
-- >>> BEGIN definer_nonempty_domain <<<
select n.nspname as schema_name,
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
       (select substring(c from 13) from unnest(p.proconfig) c
         where c like 'search\_path=%' limit 1) as sp,
       coalesce((select substring(c from 13) from unnest(p.proconfig) c
                  where c like 'search\_path=%' limit 1), '""') <> '""' as sp_nonempty
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app', 'public', 'authz')
   and p.prosecdef
-- >>> END definer_nonempty_domain <<<
;

create temp view v419_live as select * from v419_domain where sp_nonempty;

\ir vectors/definer_search_path_freeze.psql

-- 1. DOMAIN, as a named set — `414 § 0a`'s guard, for the same reason. A sweep that quietly
--    stopped covering a schema reports the same clean 0 as one that covered everything.
select is(
  (select string_agg(distinct schema_name, ' | ' order by schema_name) from v419_domain),
  'app | authz | public',
  '§ 0a DOMAIN as a NAMED SET: the ratchet examines prosecdef functions in all three of app, authz and public. ⛔ If this reds, the domain stopped covering a schema and every clean verdict below is silent for it'
);

-- 2. ⭐ THE READING TRAP, PINNED. `authz` contributes ZERO rows to the frozen set — not because
--    it is unswept, but because all ten of its DEFINERs already use the empty form. Without
--    this, "no authz names in the artifact" reads as "authz is outside the ratchet", which is
--    the exact misreading that lets an authz DEFINER be added on a non-empty path unnoticed.
select is(
  (select (select count(*) from v419_domain where schema_name = 'authz' and sp_nonempty)::text
       || ' of ' ||
          (select count(*) from v419_domain where schema_name = 'authz')::text),
  '0 of 10',
  '§ 0b AUTHZ IS SWEPT AND CONTRIBUTES NOTHING: 0 of its 10 prosecdef functions carry a non-empty path. ⛔ Do NOT read the absence of authz names in the frozen artifact as the absence of authz from the ratchet'
);

-- 3-4. THE ANCHOR, MIRRORED (ADR 0195: one home, a gated mirror). The artifact's header carries
--    `rows=` and `md5=`; these two pin the SAME values as literals in the file that asserts
--    them. Gate 18's check D reads THESE LINES, so an artifact regenerated without updating the
--    pins reds here, and a pin edited without regenerating reds there.
--    ⚠ `collate "C"` is load-bearing: it makes SQL's ordering code-point ordering, which is what
--    the generator's JavaScript sort produces. Under the database's default collation the two
--    orderings differ on `_`, and the md5 would disagree for a set that is byte-identical.
select is(
  (select count(*)::int from definer_search_path_freeze),
  865,
  '§ 0c ROWS PIN: the frozen artifact holds exactly the 865 rows its anchor declares. ⛔ A shrink updates BOTH the artifact (via --write) and this literal; updating only one is the drift this pin exists to catch'
);

select is(
  (select md5(string_agg(sig, '|' order by sig collate "C")) from definer_search_path_freeze),
  '915172dda6da2a51d69d22c3b6cbc276',
  '§ 0d CONTENT PIN: the frozen NAMES, not merely their count. A row swapped for another row keeps § 0c green and moves this'
);

-- ============================================================================
-- § 1 — THE RATCHET.
-- ============================================================================

-- 5. THE PROPERTY, with the offender NAMED so a red is actionable rather than a bare count.
select is(
  (select coalesce(string_agg(sig, '; ' order by sig collate "C"), '')
     from v419_live where sig not in (select sig from definer_search_path_freeze)),
  '',
  '§ 1a THE RATCHET: every prosecdef function in app/public/authz carrying a NON-EMPTY search_path is in the frozen set. ⛔ A function listed here is a NEW non-empty DEFINER, which ADR 0208 D4 forbids — converge it to `set search_path = ''` with a schema-qualified body; do NOT re-run the generator to absorb it'
);

-- 6-7. SHRINK IS LEGAL — asserted POSITIVELY, not by the absence of a red. A member converging
--    to the empty form is what D4 asks for, so the ratchet must stay green AND must account for
--    the departure. Without § 1c the "shrink is legal" claim is satisfied by an instrument that
--    ignores the frozen side entirely.
--    ⚠ The subject is `app.tenant_orphan_profiles()`, deliberately: ADR 0208 D6 names it as the
--    separate subject the narrow migration does NOT touch, so this control cannot collide with
--    a real convergence in this unit.
savepoint s419_shrink;

alter function app.tenant_orphan_profiles() set search_path = '';

select is(
  (select coalesce(string_agg(sig, '; ' order by sig collate "C"), '')
     from v419_live where sig not in (select sig from definer_search_path_freeze)),
  '',
  '§ 1b A CONVERGENCE STAYS GREEN: a frozen member moving to the empty form leaves the live population and reds nothing. ⛔ If this ever reds, the ratchet has become a reason not to converge anything, which inverts D4'
);

select is(
  (select coalesce(string_agg(sig, '; ' order by sig collate "C"), '(NOTHING LEFT THE SET)')
     from definer_search_path_freeze where sig not in (select sig from v419_live)),
  'app.tenant_orphan_profiles()',
  '§ 1c ...AND THE DEPARTURE IS ACCOUNTED FOR: exactly the converged function appears on the frozen-minus-live side. ⛔ `(NOTHING LEFT THE SET)` means the ALTER above did not take effect, so § 1b measured nothing'
);

rollback to savepoint s419_shrink;

-- 8-9. THE CONTROLS. § 1a has never returned a row, so it is at this point indistinguishable
--    from a broken query. Plant TWO new DEFINERs — one on a non-empty path, one on the empty
--    form — and pin exactly which of them § 1a bites. The positive half proves the ratchet can
--    find something; the negative half proves it is bound on NON-EMPTINESS and not merely on
--    "a function absent from the artifact", which every new function is.
savepoint s419_plant;

create function public.z419_ctl_new_nonempty() returns text language sql stable
  security definer set search_path to app, public, pg_catalog as $ctl$ select 'x' $ctl$;
create function public.z419_ctl_new_empty() returns text language sql stable
  security definer set search_path to '' as $ctl$ select 'x' $ctl$;

select is(
  (select coalesce(string_agg(sig, ' | ' order by sig collate "C"), '(NOTHING FIRED)')
     from v419_live where sig not in (select sig from definer_search_path_freeze)),
  'public.z419_ctl_new_nonempty()',
  '§ 1d THE RATCHET CAN BITE, on exactly the new NON-EMPTY DEFINER and not on the new empty-form one. ⛔ `(NOTHING FIRED)` means § 1a above proved nothing: read it as VOID, not as a pass'
);

-- ⚠ NO `distinct` HERE, and that is not a style choice: `string_agg(distinct x order by x
-- collate "C")` is rejected outright ("in an aggregate with DISTINCT, ORDER BY expressions
-- must appear in argument list"), and because this assertion sits inside a savepoint the
-- error is RECOVERED by the following `rollback to savepoint` — the file then reports nine
-- tests against a plan of ten and every other verdict still reads green. Signatures are
-- unique in `pg_proc` (890 of 890 distinct, measured), so `distinct` bought nothing anyway.
select is(
  (select string_agg(sig, ' | ' order by sig collate "C")
     from v419_domain where sig like 'public.z419\_ctl\_%'),
  'public.z419_ctl_new_empty() | public.z419_ctl_new_nonempty()',
  '§ 1e BOTH PROBES WERE EXAMINED, not excluded: the empty-form probe § 1d leaves unflagged is inside the domain and was looked at, so its pass is an EXAMINATION. A probe missing here is unflagged for the same reason a deleted function is'
);

rollback to savepoint s419_plant;

-- ============================================================================
-- § 2 — RESTORE. `414 § 3`'s shape: the controls are gone, the converged member is back on its
-- original path, and the live verdict is where § 1a found it.
-- ============================================================================
select ok(
  (select count(*) from v419_domain where sig like 'public.z419\_ctl\_%') = 0
  and (select sp from v419_domain where sig = 'app.tenant_orphan_profiles()') = 'app, public, pg_catalog'
  and (select count(*) from v419_live where sig not in (select sig from definer_search_path_freeze)) = 0,
  '§ 2 RESTORE: both planted controls are gone, app.tenant_orphan_profiles() is back on its three-schema path, and the live population is clean again — § 1 mutated nothing that outlives it'
);

select * from finish();
rollback;
