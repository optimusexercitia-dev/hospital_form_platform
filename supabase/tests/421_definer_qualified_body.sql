-- 421 — D4's SECOND clause: every EMPTY-PATH SECURITY DEFINER body RESOLVES under that path.
--
-- Owed by ADR 0208 D4, whose ruling is TWO clauses — `set search_path = ''` **with schema-qualified
-- object references** — of which `419` + gate 18 assert only the first. Closes
-- `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`, whose *Closes when*
-- was `PO to rule` until the PO ruled **option (a), a catalog gate** on 2026-09-11. Unit
-- `DEFINER-QUALIFIED-BODY-GATE`. No new ADR: D4 already states the convention; this is its enforcer.
--
-- ⭐ WHY THIS CLAUSE NEEDS A GATE AT ALL, AND WHY `419` IS NOT IT. Under `search_path = ''`
-- `pg_temp` is STILL searched FIRST for relation names, and `anon`, `authenticated`, `service_role`
-- and `authenticator` all hold database `TEMP` (4 of 4, ADR 0208 D5's census). So an UNQUALIFIED
-- relation inside an empty-path DEFINER stays shadowable by a temp object: the empty path NARROWS
-- the exposure, the qualified body is what CLOSES it. `419` reads `proconfig` and never a body;
-- gate 18 compares committed bytes and never opens a database. This file reads the BODIES.
--
-- ⛔⛔ POSTGRES DOES THE RESOLUTION — THERE IS NO PARSER HERE, AND THAT IS THE WHOLE DESIGN.
-- A regex over `from`/`join` targets would have to re-implement name resolution (CTEs, aliases,
-- record variables, `insert into`, `update`, `delete`, casts to composite types, `%rowtype`), and
-- every case it got wrong would be a SILENT pass. Both arms hand the function to Postgres and read
-- back the sqlstate Postgres itself raises. The finding set is exactly `42P01` (undefined_table) and
-- `42883` (undefined_function) — the two errors an unqualified reference produces under `''`.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ⚠ WHY THERE ARE TWO ARMS, KEYED ON `pg_language`, AND WHY NEITHER COVERS THE OTHER'S MEMBERS
--
--   plpgsql (18)  `plpgsql_check_function_tb` — a plpgsql body is NEVER name-resolved at CREATE
--                 time (`check_function_bodies` only parses it), so nothing in the catalog has
--                 ever looked at these bodies. The checker applies the function's OWN `proconfig`,
--                 not the session path: measured 2026-09-11, a plant on `''` reading `profiles`
--                 unqualified reds even when the SESSION path is `public, app, pg_catalog`.
--
--   sql (11)      re-execute `pg_get_functiondef(oid)`. A `language sql` body IS validated at
--                 CREATE under its declared `proconfig` — but `ALTER FUNCTION … SET search_path`
--                 NEVER re-validates. That is not hypothetical: it is the exact shape of
--                 `public.tenant_orphan_profiles`'s convergence and of every narrow `ALTER`
--                 migration this program writes (`20261003007410`, `20261003007420`). Re-emitting
--                 the definition runs the validator again, under the path the catalog now carries.
--
-- ⛔ A member is in exactly one arm. `§ 0c` pins the split as a NAMED STRING so an arm that
-- silently stopped covering its language reads as a red, not as a clean 0.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ⚠ WHY THIS FILE CREATES AN EXTENSION, WHICH NO OTHER TEST FILE DOES
--
-- `plpgsql_check` is available in the image (`pg_available_extensions`: 2.8) and NOT installed.
-- The gate needs an instrument the catalog does not carry. `create extension` runs INSIDE this
-- file's `begin; … rollback;`, so it is rolled back with everything else and the catalog is
-- untouched — no migration, nothing for `419`/gate 18/`414` to see, nothing shipped to production.
-- ⛔ Installing it by MIGRATION was offered to the PO and NOT taken; do not "simplify" this into
-- one. ⛔ And an unavailable extension must RED, never `skip`: `§ 0a` asserts availability before
-- the `create`, and if the create still fails the file ABORTS, which pg_prove reports as a failure.
-- A skip here would be the purest form of a gate that cannot fail.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ⛔ THE SAVEPOINT TRAP, AND HOW EACH ARM ANSWERS IT (LESSONS: an assertion that RAISES inside a
-- savepoint is RECOVERED by the following `rollback to savepoint` and silently never runs).
-- EVERY assertion in this file sits OUTSIDE every savepoint. The sql arm and the sql control must
-- still mutate (`create or replace`) and roll that back, so their results leave the savepoint on a
-- channel `rollback to savepoint` cannot reach: **`setval` on a temp sequence is NON-TRANSACTIONAL**
-- (verified 2026-09-11: 42 set inside a savepoint survives its rollback; a row inserted into a temp
-- table in the same savepoint does not). Each counter is seeded to **0 = THE BLOCK NEVER RAN** and
-- written as `value + 1`, so "the measurement did not happen" is a DIFFERENT reading from "the
-- measurement found nothing" — the distinction a bare 0 would destroy. Findings are additionally
-- `raise warning`-ed from inside the block so a red names the function, sqlstate and message in the
-- run log. ⛔ Do not "tidy" the +1 away.
--
-- ⚠ THE plpgsql ARM TAKES NO SAVEPOINT BECAUSE IT MUTATES NOTHING — `plpgsql_check_function_tb` is
-- read-only — so its findings live in an ordinary temp table WITH their text, and the three plpgsql
-- controls plant, measure and `drop` explicitly (`§ 5` asserts the restore). A savepoint there would
-- have discarded the very rows the assertion reads.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ⛔ THE STATED RESIDUAL, WHICH IS A BOUND AND NOT COVERAGE (`§ 4`). Dynamic SQL is OPAQUE to both
-- arms: `execute 'select … from profiles'` is a string until run time, so neither `plpgsql_check`
-- nor the sql validator can resolve it, and a green here says NOTHING about such a body. The
-- population is held at **0 bodies containing `execute`**, so today the residual is EMPTY and the
-- gate's coverage is total over the 29. ⛔ The day that count moves, this gate's claim narrows and
-- the assertion is what tells you — do not raise the number to make it pass.
--
-- ⚠ A SECOND BOUND, STATED: THE TEMP-TABLE EXCLUSION IN `§ 1`, AND EXACTLY HOW FAR IT REACHES.
-- A `42P01` is excused ONLY when the SAME body creates that relation with `create temp table`.
-- Three things make that bound real, and each of the three was a live OVER-MATCH until QA r1
-- measured it (`docs/reviews/definer-qualified-body-gate-review.md`, MINOR-1):
--   1. the finding's relation name is regex-ESCAPED character-by-character, so an identifier
--      carrying a metacharacter cannot widen the match (`.*` as a name does not match `zzz`);
--   2. the interpolated name is BOUNDED by `\m`…`\M`, so a body creating `_xy` no longer excuses
--      a finding on `_x` — a PREFIX over-match, measured true before the anchor and false after;
--   3. the match runs over EXECUTABLE TEXT ONLY: `prosrc` is scrubbed of `/* */` block comments,
--      `--` line comments and SINGLE-QUOTED string literals BEFORE matching, so a
--      `create temp table foo` written in a comment or inside a single-quoted literal no longer
--      excuses a real finding on `foo`. ⛔ DOLLAR-QUOTED text is NOT scrubbed — the gap statement
--      directly below is where that bound lives, and it is the one gap that errs UNSAFE.
-- ⛔ THE SCRUB IS A REGEX CHAIN, NOT A LEXER, AND ITS GAPS DO NOT ALL ERR IN THE SAME DIRECTION.
-- ⚠ THE ONE THAT ERRS UNSAFE IS THE DOLLAR-QUOTE GAP — item 3's own defect, one quoting syntax
-- over. A dollar-quoted string (`$q$…$q$`, `$$…$$`) is NOT stripped, so a `create temp table foo`
-- written as PROSE inside one survives into `exec_src` and EXCUSES a real finding on `foo`:
-- under-report, the unsafe direction. Measured, not reasoned (QA r2 MINOR-4, probe cases G1/G2 —
-- both read `EXCLUDED`); this header used to claim the opposite for it, and that claim was false.
-- ⛔ Two things BOUND the gap. Neither is a fix, and saying so is the point of stating it here:
--   (a) it is NOT LIVE — `0 of the 29` bodies contain a dollar-quote tag at all
--       (`src ~ '\$[A-Za-z_]*\$'`, re-measured on the live catalog; `/\*` is 0 likewise, and the
--       18 bodies carrying `--` comments are text the chain does handle);
--   (b) it CANNOT ARRIVE UNNOTICED — `§ 1b` pins `string_agg(distinct relname)` over the RAW,
--       PRE-exclusion finding set at exactly the five D6 relations, so a body that excused a
--       `foo` this way puts `foo` into that set and REDS `§ 1b`, whose own message forbids
--       re-baselining it. A designed tripwire, not an incidental guard.
-- ⛔ NO DOLLAR-QUOTE STRIPPER IS ADDED, DELIBERATELY (QA r2 recommends against it). The tag is
-- ARBITRARY — `$` + any identifier + `$`, matched by its own closing twin — so stripping it
-- correctly is a LEXER, not a fourth `regexp_replace`; a stripper that gets the tag wrong
-- swallows the wrong span and blinds in this SAME unsafe direction, while adding a gap no control
-- names. The honest bound plus `§ 1b` is worth more than a longer chain. ⛔ And do not "fix" any
-- gap by WIDENING the exclusion either.
-- ⚠ THE GAPS THAT ERR SAFE (over-report: swallowing MORE text can only take a `create temp table`
-- OUT of view, which KEEPS a finding; it can never invent one) — a nested `/* /* */ */` strips
-- only to the first `*/` (G3); a `/*` sitting inside a single-quoted literal is eaten by the
-- block-comment stage, which runs first (G4 — a FOURTH gap the earlier list omitted); and an
-- unbalanced apostrophe makes the literal rule swallow on to the next one. An `E'…'` escape
-- string is no gap at all — its quoted text goes with every other literal (G5, measured KEPT).
-- `§ 3d`, `§ 3f` and `§ 3g` are the controls that hold items 1–3, each with both halves in one
-- string.
--
-- ⚠ NO `test_helpers.bootstrap()`, no fixture, no tenancy — `pg_proc`, `pg_namespace`, `pg_language`
-- and the planted controls only, so this file is invariant to seed scale and to the AE4 perf
-- fixture. Same posture as `414` and `419`.
--
-- ⚠ pgTAP's own `# Looks like you planned N tests but ran M` is noise (its counter unwinds on
-- `rollback to savepoint` while the TAP stream pg_prove parses is already emitted); pg_prove's
-- **"Bad plan"** is a FAILURE. See `419`'s header for the full statement of that distinction.
--
-- RUN SHAPE: `Files=2, Tests=20` (19 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a
-- count mismatch.

begin;
select plan(19);

-- ============================================================================
-- § 0 — THE INSTRUMENT AND THE DOMAIN.
-- ============================================================================

-- 1. AVAILABILITY FIRST, so an image without the extension reds with a diagnosis instead of an
--    unexplained abort two statements later.
select is(
  (select count(*)::int from pg_available_extensions where name = 'plpgsql_check'),
  1,
  '§ 0a THE INSTRUMENT IS AVAILABLE: plpgsql_check is offered by this Postgres image. ⛔ If this reds the whole plpgsql arm below is VOID — fix the image, never skip the file: a gate that skips when its instrument is missing cannot fail'
);

create extension if not exists plpgsql_check with schema extensions;

-- 2. AND IT IS ACTUALLY INSTALLED IN THIS TRANSACTION. ⛔ `if not exists` is silent when the
--    extension is already there AND when the create is a no-op for any other reason; this reads
--    `pg_extension` rather than trusting the DDL's exit.
select is(
  (select count(*)::int from pg_extension where extname = 'plpgsql_check'),
  1,
  '§ 0b THE INSTRUMENT IS INSTALLED, read from pg_extension and not inferred from `create extension` returning quietly. It is created INSIDE this transaction and rolled back with it — ⛔ no migration installs it, and the catalog this file examines is the one production runs'
);

-- The domain: the same population `414` and `419 § 0` examine — every `prosecdef` function in
-- app/public/authz — with its language and its declared path, split by that path's emptiness.
-- ⛔ This is 421's OWN predicate, deliberately NOT a splice of `419 § 0`: gate 18 compares that
-- block byte-for-byte with `scripts/definer-search-path-census.sql`, so editing or copying it here
-- would either red gate 18 or bind this file to a text the generator owns. `§ 0c` asserts the two
-- populations still PARTITION the whole, which is the property the splice would have bought.
create temp view v421_domain as
select p.oid                                                                           as oid,
       n.nspname                                                                       as schema_name,
       l.lanname                                                                       as lang,
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
       p.prosrc                                                                        as src,
       coalesce((select substring(c from 13) from unnest(p.proconfig) c
                  where c like 'search\_path=%' limit 1), '<none>')                     as sp
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
 where n.nspname in ('app', 'public', 'authz')
   and p.prosecdef;

create temp view v421_empty as select * from v421_domain where sp = '""';

-- THE PARTITION'S FOUR COUNTS, DEFINED ONCE. `§ 0c` prints them and `§ 3h` moves them, so the
-- control exercises the SAME expression the gate prints rather than a hand-written copy of it —
-- a harness holding its own copy of production text is a control that certifies itself.
-- ⛔ `n_nonempty` EXCLUDES `<none>` deliberately (2026-09-12). It used to read `sp <> '""'`, which
-- is TRUE for `<none>`, so an undeclared newcomer was added to the term that names `419` — the
-- printed line read `891 = 862 non-empty (419) + 29 empty (421) | 1 undeclared` (the QA r1 probe of
-- unit DEFINER-QUALIFIED-BODY-GATE), double-counting it into a gate whose domain it is not in.
-- ⚠ WHAT THE EXCLUSION CHANGES, STATED PRECISELY (QA r1 NOTE-1 — the earlier wording here, *"the
-- three terms no longer sum by construction"*, was backwards). BEFORE: `n_nonempty` and `n_empty`
-- summed to the total by construction and an `<none>` member was counted TWICE, once in
-- `n_nonempty` and once in `n_undeclared`. AFTER: the three class terms PARTITION the total —
-- every member lands in exactly one, and all three still sum to it. The gain is not arithmetic; it
-- is that `n_undeclared` is now the ONLY term a newcomer of its class moves, so the class is
-- attributable from the printed line instead of hiding inside the term that names `419`.
-- `§ 3h` asserts exactly that, as a delta.
create temp view v421_partition as
select (select count(*) from v421_domain)                                    as n_total,
       (select count(*) from v421_domain where sp <> '""' and sp <> '<none>') as n_nonempty,
       (select count(*) from v421_domain where sp = '""')                     as n_empty,
       (select count(*) from v421_domain where sp = '<none>')                 as n_undeclared;

-- 3. THE PARTITION. `419` freezes the NON-EMPTY side (860) and this file gates the EMPTY side (30);
--    the two must still sum to `414`'s whole population (890). ⛔ Without this, a member that
--    acquired an `<none>` or some third form would fall out of BOTH gates and neither would red.
-- ⚠ THE `0 undeclared` TERM IS THE NON-TAUTOLOGICAL ONE, and the ONLY term a newcomer of that class
--    moves. It is in NEITHER gate's domain — ⛔ NOT, as this comment said until 2026-09-12,
--    "counted on 419's side": `scripts/definer-search-path-census.sql`'s `definer_nonempty_domain`
--    block COALESCES a missing value to `'""'`, so an undeclared DEFINER is `sp_nonempty = false`
--    there and never enters the frozen set `419` ratchets, while `421`'s own arms read only the
--    EMPTY form. The false clause was true of the PRINTED STRING and false of the catalog, which is
--    why the term is now excluded from `n_nonempty` above.
-- ⭐ THE CLASS IS RULED AND `414 § 0b` OWNS IT (PO 2026-09-11): a `prosecdef` function with no
--    `search_path` is a DEFECT to converge to `''`, never a member to add to any frozen set. This
--    term is the COUNT; the remedy and the offender's name live in `414 § 0b`'s red. ⛔ Two gates,
--    one remedy — do not grow a third assertion here.
select is(
  (select n_total::text || ' = ' || n_nonempty::text || ' non-empty (419) + ' ||
          n_empty::text || ' empty (421) | ' || n_undeclared::text || ' undeclared'
     from v421_partition),
  -- ⚠⚠ RE-PINNED +1 ACROSS § 0c, § 0d, § 1a/§ 2a AND § 5 AT AE5 T7 (2026-09-14), OBSERVED
  --    RED FIRST, AND THE DELTA IS ONE NAMED FUNCTION: `app.can_cases_deliberation_read_in_commission`,
  --    the 21st door (lead ruling L20), created with `set search_path = ''` and a
  --    schema-qualified body. 912 -> 913 total, empty 76 -> 77, the `language sql` arm
  --    41 -> 42; the 419 side did NOT move (836), because the new door was born on the
  --    empty path and never entered the frozen set. ⛔ A +1 on BOTH sides would have meant a
  --    function counted twice and the partition claim below broken.
  '913 = 836 non-empty (419) + 77 empty (421) | 0 undeclared',
  '§ 0c THE TWO GATES PARTITION THE POPULATION: every prosecdef function in app/public/authz is either frozen by 419 or body-checked here, with nothing in between. ⛔ `undeclared` moving off 0 means a member is in NEITHER gate''s domain while both stay green — and `414 § 0b` is the assertion that OWNS that finding: it names the offender and its ONE remedy, converge it to `set search_path = ''''` with schema-qualified references (ADR 0208 D4; PO ruled 2026-09-11), ⛔ never by widening 414/419 and never by adding it to the frozen set. ⚠ The two middle figures MOVE when a member converges to the empty form, which is exactly what D4 asks for — that is a re-baseline (here AND 419 § 0c/§ 0d, in the same change, after re-running the generator), never a reason not to converge'
);

-- 4. THE ARMS' OWN DOMAIN, AS A NAMED SET. An arm that stopped covering its language returns the
--    same clean 0 as an arm that covered everything, and the schema list is `414 § 0a`'s guard.
select is(
  (select (select count(*) from v421_empty where lang = 'plpgsql')::text || ' plpgsql | ' ||
          (select count(*) from v421_empty where lang = 'sql')::text || ' sql | ' ||
          (select string_agg(distinct schema_name, ' ' order by schema_name) from v421_domain)),
  '35 plpgsql | 42 sql | app authz public',
  '§ 0d THE SPLIT AND THE SCHEMAS, NAMED: 19 members go to the plpgsql arm, 11 to the sql arm, and the domain still spans all three schemas. ⛔ If a language count drops to 0 its arm below proves nothing while still reporting green'
);

-- ============================================================================
-- § 1 — THE plpgsql ARM. Read-only, so no savepoint and the findings keep their text.
-- ============================================================================

-- ⚠ `left join lateral … on true`, NOT `cross join lateral`: a member the checker clears produces
-- ZERO rows, and a cross join would drop it — making "was every member examined?" unanswerable
-- from the result. The left join keeps one all-NULL row per clean member, which is what `§ 1a`
-- counts. `tgrelid` comes from `pg_trigger` because the checker needs the trigger's relation to
-- type `NEW`/`OLD`; 0 for a non-trigger function.
-- ⚠ `exec_src` IS THE BODY WITH ITS NON-EXECUTABLE TEXT REMOVED, and it exists for exactly one
-- consumer: the temp-table exclusion below, which must not be satisfiable by prose. The chain is
-- block comments -> `--` line comments -> single-quoted string literals, each replaced by a
-- SPACE (never by nothing, so two tokens either side of a stripped comment cannot fuse into one).
-- ⛔ Its gaps — three that err toward KEEPING a finding and ONE, dollar-quoted text, that errs the
-- other way and is bounded rather than fixed: header, second bound.
create temp view v421_plpgsql_raw as
select m.sig, m.src, m.oid, f.sqlstate, f.message,
       substring(f.message from 'relation "([^"]+)" does not exist') as relname,
       regexp_replace(
         regexp_replace(
           regexp_replace(m.src, '/\*.*?\*/', ' ', 'g'),
           '--.*', ' ', 'gn'),
         $re$'(''|[^'])*'$re$, ' ', 'g')                              as exec_src
  from v421_empty m
  left join lateral extensions.plpgsql_check_function_tb(
       m.oid,
       coalesce((select t.tgrelid from pg_trigger t where t.tgfoid = m.oid limit 1), 0),
       fatal_errors => false) f on true
 where m.lang = 'plpgsql';

-- THE EXCLUSION, and its exact bound. A `42P01` is EXCUSED only when the SAME body creates that
-- relation as a temporary table — the four DEFINERs ADR 0208 D6 names, whose unqualified reads
-- resolve through `pg_temp` at run time and whose convergence `420` guards. ⛔ It excuses nothing
-- else: not a different function's temp table, not a `create table`, not a `42883`, not a relation
-- whose name is merely a PREFIX of one the body creates (`\M`), and not a `create temp table`
-- that lives only in a comment or a SINGLE-QUOTED literal (`exec_src`; dollar-quoted text is not
-- scrubbed — header, second bound). Each of those five was written
-- as a claim before it was true; the last two were measured OVER-MATCHING by QA r1 and are now
-- carried by `§ 3f` and `§ 3g`. The relation name is escaped before interpolation, and `\m`/`\M`
-- bound the match on both sides (header, second bound).
create temp view v421_plpgsql_findings as
select r.sig, r.sqlstate, r.message
  from v421_plpgsql_raw r
 where r.sqlstate in ('42P01', '42883')
   and not (r.sqlstate = '42P01'
            and r.relname is not null
            and r.exec_src ~* ('\mcreate\s+temp(orary)?\s+table\s+(if\s+not\s+exists\s+)?'
                          || regexp_replace(r.relname, '([^[:alnum:]])', '\\\1', 'g')
                          || '\M'));

-- The live verdict is MATERIALISED here, before any plant exists, so `§ 3`'s controls cannot
-- contaminate it and `§ 5` can re-read the view to prove the restore.
create temp table t421_live_findings as select * from v421_plpgsql_findings;
create temp table t421_live_raw as
select sig, sqlstate, relname from v421_plpgsql_raw where sqlstate in ('42P01', '42883');
create temp table t421_live_examined as select distinct sig from v421_plpgsql_raw;

-- 5. EVERY MEMBER WAS EXAMINED. ⛔ This is the half a finding count cannot carry: a checker that
--    silently returned nothing for a member is indistinguishable from one that cleared it.
select is(
  (select count(*)::int from t421_live_examined),
  35,
  '§ 1a EVERY plpgsql MEMBER REACHED THE INSTRUMENT: plpgsql_check returned for all 35, clean ones included. ⛔ A member missing here was never looked at, and § 1c is silent for it'
);

-- 6. THE INSTRUMENT IS LIVE ON THIS CATALOG, AND THE EXCLUSION IS WHAT MAKES § 1c GREEN. Without
--    this, `§ 1c`'s empty result is indistinguishable from a broken query: it would read the same
--    if the checker returned nothing at all. The four D6 temp-table DEFINERs DO raise 42P01 here,
--    on exactly the five relations their own bodies create, and the exclusion is what removes them.
select is(
  (select case when count(*) > 0 then 'RAW>0' else 'RAW=0' end from t421_live_raw)
  || ' | ' ||
  (select string_agg(distinct relname, ' ' order by relname) from t421_live_raw),
  'RAW>0 | _clone_item_map _clone_section_map _clone_standard_map _copy_answer_map _tpl_phase_map',
  '§ 1b THE ARM PRODUCES FINDINGS ON THE LIVE CATALOG, on exactly the five relations the four D6 temp-table DEFINERs create for themselves. ⛔ `RAW=0` means the instrument found nothing at all and § 1c below is VOID, not a pass; a name appearing or leaving here means the exclusion set moved and must be re-reasoned, never re-baselined'
);

-- 7. THE PROPERTY.
select is(
  (select coalesce(string_agg(sig || ' ' || sqlstate || ' ' || message, '; ' order by sig collate "C"), '')
     from t421_live_findings),
  '',
  '§ 1c THE plpgsql HALF OF D4: no empty-path plpgsql DEFINER body names a relation or function that fails to resolve under `search_path = ''''`. ⛔ A function listed here has an UNQUALIFIED reference — schema-qualify it in a forward migration (ADR 0208 D4); ⛔ do NOT widen the exclusion and do NOT put the schema back on the path'
);

-- ============================================================================
-- § 2 — THE sql ARM. It MUTATES (`create or replace`), so it runs inside a savepoint that is
-- always rolled back, and its result leaves on the sequence channel described in the header.
-- ============================================================================

create temp table t421_sql_before as
select sig, pg_get_functiondef(oid) as def, oid from v421_empty where lang = 'sql';

create temp sequence sq421_sql_visited  minvalue 0 start 0;
create temp sequence sq421_sql_findings minvalue 0 start 0;
select setval('sq421_sql_visited', 0), setval('sq421_sql_findings', 0);

savepoint s421_sql_reemit;

do $do$
declare r record; visited int := 0; found int := 0;
begin
  for r in select oid, sig from v421_empty where lang = 'sql' order by sig loop
    visited := visited + 1;
    begin
      -- ⛔ The function's OWN definition, so a success is an identity re-emission. The savepoint
      -- rollback below undoes it regardless, and § 2b proves it did.
      execute pg_get_functiondef(r.oid);
    exception when others then
      if sqlstate in ('42P01', '42883') then
        found := found + 1;
        raise warning '421 § 2 SQL ARM FINDING: % | % | %', r.sig, sqlstate, sqlerrm;
      end if;
    end;
  end loop;
  -- +1 so that 0 can only mean "this block never ran"; setval is not rolled back.
  perform setval('sq421_sql_visited', visited + 1);
  perform setval('sq421_sql_findings', found + 1);
end $do$;

rollback to savepoint s421_sql_reemit;

-- 8. THE PROPERTY, WITH ITS OWN NON-VACUITY BOUND IN THE SAME STRING. ⛔ `0 visited` would produce
--    `0 findings` too, and a findings-only assertion would read that as a pass.
select is(
  (currval('sq421_sql_visited') - 1)::text || ' visited | ' ||
  (currval('sq421_sql_findings') - 1)::text || ' findings',
  '42 visited | 0 findings',
  '§ 2a THE sql HALF OF D4: all 42 empty-path `language sql` DEFINERs re-emit under their declared path with no 42P01/42883. ⛔ `-1 visited` means the DO block never ran at all (the sequences still hold their seed) and this verdict is VOID; findings are named by `WARNING` lines in the run log'
);

-- 9. THE ARM CLEANED UP AFTER ITSELF. The re-emission is an identity operation by construction,
--    but "by construction" is exactly the kind of claim that rots; this measures it.
select is(
  (select count(*)::int from t421_sql_before b
    where b.def is distinct from pg_get_functiondef(b.oid)),
  0,
  '§ 2b THE sql ARM PERSISTED NOTHING: every one of the 11 definitions is byte-identical to its pre-savepoint snapshot. ⛔ If this reds, a `create or replace` survived the rollback and the catalog this suite leaves behind is not the one it found'
);

-- ============================================================================
-- § 3 — THE CONTROLS. Every verdict above is a clean 0, and an instrument that cannot fail returns
-- a clean 0 too. Each plant is a DEFINER on `''` naming an object that does NOT resolve under that
-- path — one that needs a schema (`profiles`, `is_admin()`), or one that exists nowhere at all
-- (`_x`, `_cmt`, `_lit`, the exclusion-bound plants) — and each is pinned to the arm it must red
-- in. ⚠ Which is not the same claim per plant: the qualified twin `§ 3b` is the ONLY one that must
-- stay silent, and `§ 3b` proves it was examined rather than skipped.
-- ⛔ A control that cannot red VOIDS its arm — read a missing plant here as "§ 1c / § 2a proved
-- nothing", never as "the plants were unnecessary".
-- ============================================================================

create function public.z421_ctl_unqualified() returns bigint language plpgsql security definer
  set search_path = '' as $ctl$ begin return (select count(*) from profiles); end $ctl$;

create function public.z421_ctl_qualified() returns bigint language plpgsql security definer
  set search_path = '' as $ctl$ begin return (select count(*) from public.profiles); end $ctl$;

create function public.z421_ctl_missing_fn() returns boolean language plpgsql security definer
  set search_path = '' as $ctl$ begin return is_admin(); end $ctl$;

-- The discrimination plant: it DOES create a temp table, so the exclusion fires for `_x` — and it
-- ALSO reads `profiles` unqualified, which the exclusion must NOT reach.
create function public.z421_ctl_temp_plus_unqualified() returns bigint language plpgsql security definer
  set search_path = '' as $ctl$
  begin
    create temp table _x(i int);
    insert into _x select 1;
    return (select count(*) from profiles) + (select count(*) from _x);
  end $ctl$;

-- The PREFIX discrimination plant (QA r1 MINOR-1). It creates temp `_xy` and reads an unqualified
-- `_x` that exists NOWHERE — so the arm raises `42P01` for both names, and the exclusion must
-- excuse only the one this body actually creates. ⛔ Without the `\M` bound the finding on `_x`
-- was EXCUSED by the `create temp table _xy`, which is the unsafe direction: a real unqualified
-- reference silently dropped because some other relation's name starts with it.
-- ⚠ ONE UNQUALIFIED REFERENCE PER STATEMENT, in both new plants. Parse analysis stops at the
-- FIRST unresolved name in a statement, so `(select … from _x) + (select … from _xy)` would have
-- reported `_x` only and the other half of each assertion would have been silently unreachable —
-- a control whose fixture cannot reach the state it claims to measure.
create function public.z421_ctl_temp_prefix() returns bigint language plpgsql security definer
  set search_path = '' as $ctl$
  declare a bigint; b bigint;
  begin
    create temp table _xy(i int);
    insert into _xy select 1;
    a := (select count(*) from _x);
    b := (select count(*) from _xy);
    return a + b;
  end $ctl$;

-- The NON-EXECUTABLE-TEXT discrimination plant (QA r1 MINOR-1). Its only two `create temp table`
-- strings live in a `--` comment and in a SINGLE-QUOTED literal; it creates NO temp table at all
-- and reads both names unqualified. ⛔ Both findings must be KEPT: prose the scrub can see excuses
-- nothing. ⚠ Dollar-quoted prose is the text it CANNOT see, and no control plants that shape —
-- header, second bound, states the gap and its two bounds instead.
create function public.z421_ctl_text_temp() returns bigint language plpgsql security definer
  set search_path = '' as $ctl$
  declare s text; a bigint; b bigint;
  begin
    -- create temp table _cmt(i int)
    s := 'create temp table _lit(i int)';
    a := (select count(*) from _cmt);
    b := (select count(*) from _lit);
    return a + b + length(s);
  end $ctl$;

create temp table t421_ctl_findings as
select sig, sqlstate, message from v421_plpgsql_findings where sig like 'public.z421\_ctl\_%';
create temp table t421_ctl_raw as
select sig, sqlstate, relname from v421_plpgsql_raw
 where sig like 'public.z421\_ctl\_%' and sqlstate in ('42P01', '42883');

-- 10. THE POSITIVE CONTROL, AND THE NEGATIVE ONE IN THE SAME STRING. The qualified twin differs
--     from the unqualified plant in exactly one token, so its silence isolates the property to
--     QUALIFICATION rather than to "being a new function", which both plants are.
select is(
  (select coalesce(string_agg(sig || ' ' || sqlstate, ' ; ' order by sig collate "C"), '(NOTHING FIRED)')
     from t421_ctl_findings
    where sig in ('public.z421_ctl_unqualified()', 'public.z421_ctl_qualified()')),
  'public.z421_ctl_unqualified() 42P01',
  '§ 3a THE plpgsql ARM CAN BITE, on the unqualified plant and NOT on its schema-qualified twin. ⛔ `(NOTHING FIRED)` means § 1c is VOID; both names appearing means the arm reds on any new function and § 1c''s green is about nothing'
);

-- 11. AND THE TWIN WAS EXAMINED, not merely absent. A pass earned by never being looked at is the
--     same shape as a deleted function's pass (`419 § 1e`).
select is(
  (select count(*)::int from v421_plpgsql_raw where sig = 'public.z421_ctl_qualified()'),
  1,
  '§ 3b THE CLEAN TWIN WAS EXAMINED: plpgsql_check returned for it (one all-NULL row, no findings), so its absence from § 3a is an EXAMINATION and not an omission'
);

-- 12. THE 42883 HALF OF THE FINDING SET IS LIVE. The live population produces only 42P01, so
--     without this plant the `42883` term in every predicate above is untested — it could be
--     misspelled and nothing would notice.
select is(
  (select coalesce(string_agg(sqlstate, ' ' order by sqlstate), '(NOTHING FIRED)')
     from t421_ctl_findings where sig = 'public.z421_ctl_missing_fn()'),
  '42883',
  '§ 3c THE 42883 TERM IS LIVE: an unqualified FUNCTION call under `''''` reds too, not only an unqualified relation. ⛔ The live catalog raises only 42P01, so without this plant the 42883 half of the finding set is carried by no assertion at all'
);

-- 13. THE EXCLUSION FIRES, AND IS BOUND. Both halves in one string, because either alone is
--     satisfiable by a broken exclusion: an exclusion that matched NOTHING would keep `profiles`
--     (and red § 1c on the four D6 functions), and one that matched EVERYTHING would drop
--     `profiles` (and silently blind the whole arm).
-- ⛔ `position(… in …)`, NOT `like '%"' || relname || '"%'` (QA r1 MINOR-2): every relation name
--     this file handles begins with `_`, which is a SINGLE-CHARACTER WILDCARD in LIKE — measured,
--     `'relation "ax" does not exist' like '%"_x"%'` is TRUE. A control that certifies a bound
--     must not be looser than the thing it certifies.
select is(
  coalesce((select string_agg(x.entry, ' | ' order by x.entry collate "C")
              from (select distinct r.relname || '=' ||
                           case when exists (select 1 from t421_ctl_findings f
                                              where f.sig = r.sig
                                                and position('"' || r.relname || '"' in f.message) > 0)
                                then 'KEPT' else 'EXCLUDED' end as entry
                      from t421_ctl_raw r
                     where r.sig = 'public.z421_ctl_temp_plus_unqualified()') x), '(NOTHING FIRED)'),
  '_x=EXCLUDED | profiles=KEPT',
  '§ 3d THE TEMP-TABLE EXCLUSION DOES NOT BLIND: in ONE body it excuses the relation that body creates (`_x`) and keeps the one it does not (`profiles`). ⛔ `profiles=EXCLUDED` means the exclusion swallows real findings and § 1c is worthless; `_x=KEPT` means it never fires and the four D6 functions would red for the wrong reason'
);

-- 14. THE EXCLUSION IS BOUND ON THE RIGHT. Same shape as § 3d, one token apart: the body creates
--     `_xy` and reads `_x`, which no relation anywhere provides. ⛔ `_x=EXCLUDED` is the QA r1
--     MINOR-1 defect — a PREFIX of a created temp table excusing a real finding.
select is(
  coalesce((select string_agg(x.entry, ' | ' order by x.entry collate "C")
              from (select distinct r.relname || '=' ||
                           case when exists (select 1 from t421_ctl_findings f
                                              where f.sig = r.sig
                                                and position('"' || r.relname || '"' in f.message) > 0)
                                then 'KEPT' else 'EXCLUDED' end as entry
                      from t421_ctl_raw r
                     where r.sig = 'public.z421_ctl_temp_prefix()') x), '(NOTHING FIRED)'),
  '_x=KEPT | _xy=EXCLUDED',
  '§ 3f THE EXCLUSION HAS A RIGHT-HAND BOUND: a body creating temp `_xy` excuses `_xy` and NOT the unqualified `_x` it also reads. ⛔ `_x=EXCLUDED` means the interpolated name lost its `\M` anchor and any finding whose name PREFIXES a created temp table is silently dropped; `_xy=KEPT` means the anchor is too tight and the four D6 functions would red for the wrong reason'
);

-- 15. THE EXCLUSION READS EXECUTABLE TEXT ONLY. The plant creates no temp table at all — both
--     `create temp table` strings are prose. ⛔ Either name reading `EXCLUDED` means a comment or
--     a literal can talk the gate out of a finding, which is the QA r1 MINOR-1 unsafe direction.
select is(
  coalesce((select string_agg(x.entry, ' | ' order by x.entry collate "C")
              from (select distinct r.relname || '=' ||
                           case when exists (select 1 from t421_ctl_findings f
                                              where f.sig = r.sig
                                                and position('"' || r.relname || '"' in f.message) > 0)
                                then 'KEPT' else 'EXCLUDED' end as entry
                      from t421_ctl_raw r
                     where r.sig = 'public.z421_ctl_text_temp()') x), '(NOTHING FIRED)'),
  '_cmt=KEPT | _lit=KEPT',
  '§ 3g THE EXCLUSION IGNORES COMMENTS AND STRING LITERALS: a `create temp table` written in a `--` comment (`_cmt`) or inside a single-quoted literal (`_lit`) excuses nothing, because the match runs over `exec_src` and not over raw `prosrc`. ⛔ An `EXCLUDED` here means the scrub chain stopped working and any body can excuse any finding by mentioning it in prose'
);

drop function public.z421_ctl_unqualified();
drop function public.z421_ctl_qualified();
drop function public.z421_ctl_missing_fn();
drop function public.z421_ctl_temp_plus_unqualified();
drop function public.z421_ctl_temp_prefix();
drop function public.z421_ctl_text_temp();

-- THE sql ARM'S CONTROL. Created on a NON-EMPTY path — where its unqualified body is valid and the
-- CREATE-time validator passes it — then moved to `''` by `ALTER`, which does NOT re-validate.
-- ⛔ That sequence is the hole this arm exists for, and it is the exact shape of every narrow
-- convergence migration in this program. `§ 3e` asserts BOTH that the catalog accepted the plant
-- (so only a re-emission can catch it) and that the re-emission does.
create function public.z421_ctl_sql_altered() returns bigint language sql security definer
  set search_path = public as $ctl$ select count(*) from profiles $ctl$;
alter function public.z421_ctl_sql_altered() set search_path = '';

create temp sequence sq421_c4_visited  minvalue 0 start 0;
create temp sequence sq421_c4_findings minvalue 0 start 0;
select setval('sq421_c4_visited', 0), setval('sq421_c4_findings', 0);

savepoint s421_sql_control;

do $do$
declare r record; visited int := 0; found int := 0;
begin
  for r in select oid, sig from v421_empty
            where lang = 'sql' and sig = 'public.z421_ctl_sql_altered()' loop
    visited := visited + 1;
    begin
      execute pg_get_functiondef(r.oid);
    exception when others then
      if sqlstate in ('42P01', '42883') then
        found := found + 1;
        raise warning '421 § 3e SQL CONTROL FIRED: % | % | %', r.sig, sqlstate, sqlerrm;
      end if;
    end;
  end loop;
  perform setval('sq421_c4_visited', visited + 1);
  perform setval('sq421_c4_findings', found + 1);
end $do$;

rollback to savepoint s421_sql_control;

-- 16. THE HOLE AND THE CATCH, IN ONE ASSERTION.
select is(
  (select sp from v421_domain where sig = 'public.z421_ctl_sql_altered()') || ' accepted by ALTER | ' ||
  (currval('sq421_c4_visited') - 1)::text || ' visited | ' ||
  (currval('sq421_c4_findings') - 1)::text || ' findings',
  '"" accepted by ALTER | 1 visited | 1 findings',
  '§ 3e THE sql ARM CAN BITE, on the one shape that reaches production: a body validated on a NON-EMPTY path and then moved to `""` by ALTER, which never re-validates. ⛔ `accepted by ALTER` failing means the plant never reached the empty form; `0 findings` means § 2a is VOID — the arm cannot detect the defect it exists for'
);

drop function public.z421_ctl_sql_altered();

-- ────────────────────────────────────────────────────────────────────────────
-- § 3h — THE PARTITION LINE'S OWN CONTROL (added 2026-09-12, unit
-- DEFINER-UNDECLARED-CLASS-REMEDY). `§ 0c` printed `890 / 861 / 29 / 0` from the day it was written until 2026-09-12 and now prints
-- `890 / 860 / 30 / 0` (AE5-ROLE-CATALOG-COMPAT re-typed `public.assume_role` onto the empty path);
-- a line that has only ever printed one value is indistinguishable from a line whose
-- terms are wired to the wrong predicates. This moves the catalog under it TWICE and asserts WHICH
-- terms move: an undeclared DEFINER moves the total and `undeclared` ONLY — the property the
-- `sp <> '<none>'` exclusion above buys, and the one that was FALSE before it (the newcomer used to
-- land on the `non-empty (419)` term as well) — and its `''` twin moves `empty` instead.
--
-- ⛔ A DELTA, NOT A SECOND COPY OF THE EXPECTED STRING. Re-typing `891 = 861 … | 1` here would give
-- the baseline a second home and make every future convergence a three-place re-baseline. The four
-- terms are read from `v421_partition` — the SAME view `§ 0c` formats — so no hand-written copy of
-- the production expression exists to drift from it; what this control does NOT assert is the
-- string's punctuation, which `§ 0c` alone pins.
-- ⚠ Both plants are `language sql` bodies naming NOTHING (`select 1`), so neither reaches the
-- plpgsql arm and the `''` twin cannot contribute a finding while it exists; each is dropped
-- immediately after its own snapshot, and `§ 5` re-measures that they are gone.
-- ────────────────────────────────────────────────────────────────────────────

create temp table t421_partition_snap(
  label text, n_total bigint, n_nonempty bigint, n_empty bigint, n_undeclared bigint);

insert into t421_partition_snap select 'base', * from v421_partition;

create function public.z421_ctl_undeclared() returns int language sql security definer
  as $ctl$ select 1 $ctl$;
insert into t421_partition_snap select 'undeclared plant', * from v421_partition;
drop function public.z421_ctl_undeclared();

create function public.z421_ctl_empty_twin() returns int language sql security definer
  set search_path = '' as $ctl$ select 1 $ctl$;
insert into t421_partition_snap select 'empty-form twin', * from v421_partition;
drop function public.z421_ctl_empty_twin();

-- 17. THE FOUR TERMS RESPOND, AND EACH TO THE RIGHT PLANT. Both halves in one string: either alone
--     is satisfiable by a broken line — a `non-empty` term that still swallowed `<none>` would give
--     the undeclared plant `+1` there too, and a line whose `undeclared` term were wired to a dead
--     predicate would give `+0` while the total moved.
select is(
  coalesce((select string_agg(
                     s.label
                     || ': total '      || to_char(s.n_total      - b.n_total,      'FMS999')
                     || ' non-empty '   || to_char(s.n_nonempty   - b.n_nonempty,   'FMS999')
                     || ' empty '       || to_char(s.n_empty      - b.n_empty,      'FMS999')
                     || ' undeclared '  || to_char(s.n_undeclared - b.n_undeclared, 'FMS999'),
                     ' | ' order by s.label collate "C")
              from t421_partition_snap s
              cross join (select * from t421_partition_snap where label = 'base') b
             where s.label <> 'base'), '(NOTHING MEASURED)'),
  'empty-form twin: total +1 non-empty +0 empty +1 undeclared +0 | undeclared plant: total +1 non-empty +0 empty +0 undeclared +1',
  '§ 3h § 0c''s FOUR TERMS EACH MOVE, AND ONLY FOR THEIR OWN CLASS: a planted `prosecdef` function with NO `set search_path` moves the total and `undeclared` and NOTHING else, and its `set search_path = ''''` twin moves `empty` instead. ⛔ `non-empty +1` on the undeclared plant is the pre-2026-09-12 defect — the class counted onto the term that names 419, a gate whose frozen set the census keeps it out of; `undeclared +0` means § 0c''s fourth term is wired to a predicate that cannot fire and the escape it exists to close is open. ⛔ `(NOTHING MEASURED)` means no plant ever reached the catalog and § 0c is VOID, not green. The remedy for a real red on the `undeclared` term is `414 § 0b`''s, not a new term here'
);

-- ============================================================================
-- § 4 — THE RESIDUAL. Stated as a bound, held at zero, and NOT claimed as coverage.
-- ============================================================================

-- 18. ⛔ THIS IS NOT A SAFETY ASSERTION — it is the statement of what the two arms CANNOT see.
select is(
  (select coalesce(string_agg(sig, '; ' order by sig collate "C"), '')
     from v421_empty where src ~* '\mexecute\M'),
  '',
  '§ 4 THE RESIDUAL IS EMPTY: no empty-path DEFINER body builds SQL dynamically, so both arms cover the whole population. ⛔ Dynamic SQL is OPAQUE to Postgres until run time — a body listed here is NOT checked by § 1c or § 2a and this gate says nothing about it. ⛔ A name appearing here narrows the gate''s claim and must be reasoned about, never absorbed'
);

-- ============================================================================
-- § 5 — RESTORE. `414 § 3` / `419 § 2`'s shape: the plants are gone, the population is back where
-- § 0 found it, and the live verdict is unchanged — so § 3 mutated nothing that outlives it.
-- ============================================================================

-- 19.
select ok(
      (select count(*) from v421_domain where sig like 'public.z421\_%') = 0
  and (select count(*) from v421_empty) = 77
  and (select count(*) from v421_plpgsql_findings) = 0
  and (select count(*) from t421_sql_before b
        where b.def is distinct from pg_get_functiondef(b.oid)) = 0,
  '§ 5 RESTORE: all nine planted controls are gone (the seven of § 3 plus § 3h''s undeclared plant and its empty-form twin), the empty-path population is back to 77, the plpgsql arm is clean again and the 11 sql definitions are untouched — § 2 and § 3 left nothing behind'
);

select * from finish();
rollback;
