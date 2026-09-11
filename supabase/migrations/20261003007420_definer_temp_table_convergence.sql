-- Converge the FOUR temp-table SECURITY DEFINER functions to the empty search_path.
--
-- ADR 0208 D4 ("a NEW or TOUCHED SECURITY DEFINER converges to `set search_path = ''` with a
-- schema-qualified body") is the standing convention; D6's precondition — *targeted testing
-- before any ALTER FUNCTION hardening sweep* — was discharged by pgTAP
-- `420_definer_temp_table_empty_path.sql` in unit `DEFINER-SEARCH-PATH-NARROW-FIX`, which
-- measured all four as a FREE change. Closes
-- `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-FOUR-TEMP-TABLE-DEFINERS-MEASURED-FREE-TO-CONVERGE`,
-- whose *Closes when* was `PO to rule`; the PO ruled CONVERGE on 2026-09-11. Unit
-- DEFINER-TEMP-TABLE-CONVERGENCE. ⛔ No new ADR: 0208 D5 requires one only to admit a SECOND
-- compatibility form, and this admits none.
--
-- ⭐ `ALTER FUNCTION`, NOT A RE-EMITTED BODY, and D6 says why: re-emitting a body to change one
-- attribute puts the whole body into the diff, where a reviewer has to re-read it to find out
-- that nothing in it changed. ⛔ Not one of the four bodies is touched here — which also means
-- this migration changes NO behaviour it has not measured, because the only thing it changes is
-- name resolution, and name resolution inside these four bodies is exactly what `420` measured.
--
-- ⛔ SCOPE FENCE — FOUR SIGNATURES, AND NOTHING ELSE. This is not the catalog-wide hardening
-- sweep D6 warns about. 861 non-empty DEFINER paths remain after this migration and stay frozen
-- compatibility debt under D4; they converge ON TOUCH, one ruled unit at a time.
-- ⛔ `app.tenant_orphan_profiles()` is still NOT touched (it was not touched by `20261003007410`
-- either, and `419 § 1b/1c` uses it as its shrink control — converging it here would collide
-- with that control's subject). ⛔ `app.current_professional_read_organizations` is still NOT
-- touched: `413` pins it on the three-schema string deliberately, beside its converged sibling.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- MEASURED BEFORE WRITING THIS, ON THE LIVE CATALOG (`pg_proc` via
-- `docker exec … psql`, 2026-09-11) — not read off migration text, which is stale by design
-- (ADR 0078), and not inferred from `prosrc`, which does not carry a function's attributes at
-- all (`.claude/rules/prosrc-is-not-the-whole-function.md`):
--
--   app.copy_response_answers(uuid,uuid)           prosecdef=t  proconfig={"search_path=app, public, pg_catalog"}
--   app.copy_template_version_children(uuid,uuid)  prosecdef=t  proconfig={"search_path=app, public, pg_catalog"}
--   app.copy_version_children(uuid,uuid)           prosecdef=t  proconfig={"search_path=app, public, pg_catalog"}
--   public.clone_framework(uuid,uuid)              prosecdef=t  proconfig={"search_path=app, public, pg_catalog"}
--
-- ⚠ AND EXACTLY ONE OVERLOAD EACH — 4 rows for the 4 names in `pg_proc`, measured in the same
-- breath. That is the fact these four statements rest on: an `alter function` naming one
-- signature converges the whole population of a name only while the name has one member. It is
-- not left as an accident that happens to hold today — `420 § 5d` pins it.
--
-- ⭐ THE MECHANISM, WHICH IS WHY THIS IS FREE AND IS THE REAL FINDING. The prediction going into
-- `420` was that these four would BREAK: each creates a temporary table and then references it
-- UNQUALIFIED (`insert into _tpl_phase_map`, `join _copy_answer_map m`), which an empty
-- `search_path` looked certain to leave unresolvable. ⛔ THE PREDICTION WAS WRONG. Postgres
-- searches `pg_temp` IMPLICITLY AND FIRST for relation names whenever the temp schema is not
-- listed explicitly, so `search_path = ''` does not remove the temp schema from relation
-- resolution — it removes `app` and `public`. That is the SAME mechanism ADR 0208 D5 quotes as
-- the reason to PREFER the empty form (a temp object can precede the declared schemas and shadow
-- an unqualified relation): here it is what makes these four survive; in a body naming a
-- PERSISTENT relation unqualified it is the hijack. ⛔ "Free" is therefore a statement about
-- THESE FOUR BODIES and never a general one — `420 § 6` plants a DEFINER with a bare
-- `from profiles` and REQUIRES the same ALTER to red it with 42P01, so the instrument that
-- returned four OKs is proven able to return a failure.

alter function app.copy_response_answers(uuid, uuid) set search_path = '';

alter function app.copy_template_version_children(uuid, uuid) set search_path = '';

alter function app.copy_version_children(uuid, uuid) set search_path = '';

alter function public.clone_framework(uuid, uuid) set search_path = '';

-- ⛔ WHAT THIS MIGRATION DOES NOT DO.
--   · It does not close the CLASS. 861 non-empty paths remain frozen debt (867 before
--     `20261003007410`, 865 before this file). Converging four members is not closing
--     `FUP-…-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`, which is about the OTHER clause.
--   · It does not gate the schema-qualified half of D4. Nothing here, in `419`, or in gate 18
--     reads a function BODY — and under `search_path = ''` `pg_temp` is still searched FIRST
--     while all four client roles hold database TEMP, so an unqualified relation inside an
--     empty-path DEFINER stays shadowable. The empty path NARROWS that exposure; it does not
--     close it. These four are safe because their unqualified references ARE temp tables.
--   · It does not touch the undeclared-`search_path` class (`414 § 0b`'s 890/890) — a DEFINER
--     with NO path at all is outside the freeze by construction.
--
-- ⭐ THE PINS THAT MOVE IN THIS SAME CHANGE, or the suite reds:
--   · `supabase/tests/vectors/definer_search_path_freeze.psql` — regenerated by
--     `node scripts/gen-definer-search-path-freeze.mjs --write` ONLY; the diff is a PURE
--     four-row deletion, 865 → 861, and gate 18's check F reports `removed 4, added 0`.
--   · `419 § 0c` (rows pin 865 → 861) and `419 § 0d` (the md5 over the frozen names).
--   · `420` — re-cast from "the four are measured free but UNCONVERGED" into this migration's
--     regression guard: its `§ 5`/`§ 5b` now pin all four on `search_path=""` and 0 of 4
--     non-empty, and each §'s effect assertion carries the live `proconfig` in the same string,
--     so a revert reds the effect half's own assertion rather than passing quietly beside it.
