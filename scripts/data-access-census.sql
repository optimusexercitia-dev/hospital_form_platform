-- DATA-ACCESS CENSUS -- the catalog half of the generated data-access surface (gate 17).
--
-- WHY THIS EXISTS: `docs/backend-state/data-access.md` advertises itself, through the
-- router, as where to look up an RPC, a helper, a feature flag or the query module that
-- owns a query (Architecture Rule 9). Measured 2026-09-09 against the LIVE catalog: of
-- 533 non-trigger `public` functions, 169 appeared anywhere in that file; of 42 typed
-- feature-flag fields, 18 appeared nowhere; of 109 query/action modules on disk, 36 were
-- unnamed. A hand-maintained registry does not stay a registry -- ADR 0196's own
-- § Considered options already ruled that generation is the answer FOR THE REGISTRIES.
--
-- ⛔ THE LIVE CATALOG IS THE SOLE TRUTH (CLAUDE.md § graphify, ADR 0078). Migration file
-- text is STALE BY DESIGN -- some migrations rewrite live function bodies at runtime via
-- `pg_get_functiondef()` + `replace()` + `execute`. Never derive this from migrations,
-- and never from graphify, which does not index SQL at all.
--
-- ⚠ ACL ARRAYS ARE SORTED BEFORE EMISSION, and this is not cosmetic. Postgres preserves
-- GRANT ORDER inside an aclitem[], so two catalogs holding the IDENTICAL privileges render
-- differently. Measured here on the first run: 397 functions rendered
-- `postgres,authenticated,service_role` and 284 rendered `postgres,service_role,
-- authenticated` -- one privilege multiset, two texts. An order-sensitive census churns on
-- every `db reset`, and a generator that churns gets regenerated without being read.
-- Same lesson, same remedy, as scripts/catalog-fingerprint.sql.
--
-- ⚠ A NULL `proacl` IS NOT "NO GRANTS" -- it is the DEFAULT, and for a function the default
-- INCLUDES PUBLIC EXECUTE. Emitted as the explicit token `<NULL=PUBLIC>` (the same token
-- catalog-fingerprint.sql uses) so a reader can never mistake it for a closed door.
-- 99 `app` functions are in that state today; reading them as "no grants" inverts the fact.
--
-- ⚠ TRIGGER FUNCTIONS ARE INCLUDED, marked `trigger`, because this census is the WHOLE
-- `pg_proc` population of both schemas -- that is what makes a trigger's `prosecdef` and ACL
-- visible at all, and a DEFINER trigger's gate replaces RLS exactly as a door's does.
-- ⛔ BUT THEY ARE NOT RPCs, and the generated `public` file is titled the FUNCTION surface for
-- that reason: 22 of its 555 rows are triggers, reachable only from a `CREATE TRIGGER`.
-- ⚠ An earlier version of this comment justified inclusion by "data-access.md § Helper
-- functions documents them BY NAME (`app.guard_*`, `app.trg_*`)". That is an APP-SIDE
-- rationale and it was doing duty for the public file: measured 2026-09-09, 19 of 176 `app`
-- trigger functions are named in that prose and 1 of 22 `public` ones are. Coverage of the
-- prose is not why they are here; completeness of the catalog is.
--
-- ALWAYS run with -v ON_ERROR_STOP=1. Without it psql skips a failing section and STILL
-- EXITS 0 -- the census silently narrows and the drift gate reads clean.
--
-- ⛔ THE TWO ROW EXPRESSIONS BELOW ARE THE ONE HOME FOR THE CENSUS GRAMMAR, and they are
-- extracted BY TEXT, between the `-- >>> BEGIN <name> <<<` / `-- >>> END <name> <<<`
-- markers, by scripts/gen-data-access-surface.mjs, which splices the FUNC expression into
-- the generated pgTAP suite supabase/tests/400_data_access_census.sql. Gate 17 then proves
-- the splice is still byte-identical WITHOUT a database. That is what makes "the doc
-- matches the catalog" gateable in two halves: doc == pin (gate 17, text only) and
-- pin == catalog (pgTAP, live). Neither half needs the other's environment.
-- ⛔ Editing an expression below without re-running the generator reds gate 17 by design.
--
-- HOW TO RUN IT: npm run data-access:surface   (scripts/gen-data-access-surface.mjs)

\pset tuples_only on
\pset format unaligned
\pset footer off

-- 1. FUNCTIONS: identity, security context, volatility, ACL.
-- >>> BEGIN FUNC_ROW <<<
select 'FUNC|' || n.nspname
       || '|' || p.proname
       || '|' || pg_get_function_identity_arguments(p.oid)
       || '|' || pg_catalog.format_type(p.prorettype, null)
       || '|' || case p.prosecdef when true then 'definer' else 'invoker' end
       || '|' || case p.provolatile when 'i' then 'immutable'
                                    when 's' then 'stable'
                                    else 'volatile' end
       || '|' || case when p.prorettype = 'trigger'::regtype then 'trigger' else 'function' end
       || '|' || coalesce(
                   (select string_agg(x::text, ',' order by x::text) from unnest(p.proacl) x),
                   '<NULL=PUBLIC>')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app')
  and p.prokind = 'f'
-- >>> END FUNC_ROW <<<
order by 1;

-- 2. FEATURE FLAGS: the KEY SET and the row's own description.
--    ⛔ `enabled` IS EMITTED BUT IS THE LOCAL/SEEDED VALUE, NEVER PRODUCTION'S.
--    `supabase/seed.sql` forces flags ON for local + E2E, and a flip that lives only in
--    seed.sql is OFF in production until its own migration is pushed. The generated table
--    labels the column `local` for that reason. The production state of a flag stays a
--    HANDWRITTEN claim in data-access.md § Feature flags, because only a human knows
--    whether the flip migration was pushed.
--    ⚠ `enabled` IS PART OF THE FLAGS DIGEST, and deliberately: it is the only arm covering
--    the rendered `local` column. Gate 17 parses that table's key, `FeatureFlags` field and
--    readers cells and NEVER `local`, and it never opens a database -- so excluding
--    `enabled` here would leave a generated column nothing can contradict. The cost is one
--    red per deliberate flip, cleared by `npm run data-access:surface`; on a flip MIGRATION
--    that red is the point, because it sends a human back to the handwritten claim.
--    ⛔ An earlier version of this comment said NOTHING asserts on it -- not gate 17, not the
--    pgTAP mirror. That was false in both halves and is corrected here, in the pgTAP header
--    the generator emits, and in the generated file's own preamble.
-- >>> BEGIN FLAG_ROW <<<
select 'FLAG|' || f.key
       || '|' || f.enabled::text
       || '|' || replace(replace(coalesce(f.description, ''), '|', '/'), chr(10), ' ')
from app.feature_flags f
-- >>> END FLAG_ROW <<<
order by 1;
