# DEFINER-QUALIFIED-BODY-GATE — progress record

> Hub: [definer-qualified-body-gate.md](../features/definer-qualified-body-gate.md) · branch
> `definer-qualified-body-gate`, cut from `main @ 6fd0bfdb` · owed by ADR 0208 D4 (second clause) ·
> closes `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`.

## Session log

### 2026-09-11 — unit opened; the PO ruled option (a); feasibility measured on the live catalog (lead)

**The ruling.** The follow-up offered (a) a catalog check that an empty-path DEFINER's body names no
unqualified relation, or (b) a review obligation. The PO chose **(a)**, built as pgTAP `421`, after the
spike below; the "install by migration" variant of (a) was offered and not chosen — the extension lives
inside the test transaction only.

**Why no ADR.** D4's verbatim ruling already states the two-clause convention; ADR 0208 D5 orders 419 as
the path gate and names nothing for the body clause. An enforcer for a stated convention is a unit, not
a decision.

**Feasibility spike (rolled-back transactions, container `supabase_db_azkbbhskturikxpgmafq`).**
- Population: 29 empty-path DEFINERs in `app`/`public`/`authz` — plpgsql 18 (app 9 · public 7 · authz 2),
  sql 11 (authz 8 · app 2 · public 1). `plpgsql_check` 2.8 in `pg_available_extensions`, not installed.
- plpgsql arm: a planted DEFINER on `''` with `from profiles` → `error:42P01 relation "profiles" does not
  exist`; its qualified twin → 0 rows; the same plant under `set local search_path = public, app,
  pg_catalog` STILL reds ⇒ plpgsql_check applies `proconfig`, not the session path. Unqualified
  `is_admin()` → `42883`.
- plpgsql arm over the 18 live members (trigger functions given `tgrelid`): 42P01 only on the four
  temp-table bodies, each naming a relation its own body creates (`_copy_answer_map`, `_tpl_phase_map`,
  `_clone_section_map` + `_clone_item_map`, `_clone_standard_map`); 11 of 18 produce zero findings of
  any level; the rest are `warning extra` (never-read variables) and one `55000` cascade from the temp
  miss — outside the gate's sqlstate set. Discrimination: a plant creating temp `_x` and reading
  `profiles` unqualified still reds 42P01.
- sql arm: `create function … set search_path = '' as $$ select count(*) from profiles $$` reds at CREATE
  (`check_function_bodies = on`, the validator applies `proconfig`); the SAME body created on
  `search_path = public` then `alter function … set search_path = ''` does NOT re-validate (no error) —
  the hole, and the exact shape of `tenant_orphan_profiles`'s convergence; `execute pg_get_functiondef(oid)`
  in a savepoint re-runs the validator: `REEMIT RED 42P01` on that plant, `REEMIT OK` on all 11 live.
- Residual: 0 of 29 bodies contain `execute`; the four `create temp` bodies are the 420 subjects.

**Scope fence.** 419 and 420 assertions untouched; no migration; no `.claude/rules/` file added (cap
12/12, sibling FUP `…RULES-CAP-DEFERS-THE-D5-HINT-FILE` is PO-to-rule) — only the existing rule bullet's
wording changes and must stay under the byte cap.

**Delegation.** `backend` builds 421 and re-words the five carriers; tester and QA follow the §6 order.
