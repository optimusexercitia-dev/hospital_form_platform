-- Case Correction Lifecycle — MINOR-2 fix (docs/reviews/case-corrections-review.md).
--
-- Problem: app.assert_case_corrections_enabled() raised 'check_violation' (23514)
-- when the `case_corrections` flag is OFF. But 23514 is ALSO raised — inside the very
-- same doors — by every invalid-state / shape / stale-transition guard (e.g.
-- approve/reject/review "a solicitação não está no estado necessário…", the target-XOR
-- check, guard_case_phase_status). The TS mapper (mapCorrectionError) therefore
-- collapsed BOTH meanings to "O recurso de correção de casos não está disponível.",
-- which is FALSE on the invalid-state path (a race between two coordinators, or a stale
-- page): the truthful message there is "a solicitação mudou de estado".
--
-- Fix: give "feature disabled" its own SQLSTATE, distinct from the invalid-state 23514.
-- We use HC000 — the codebase's established feature-disabled sentinel (mirrors
-- app.assert_ethics_enabled / app.assert_charters_enabled, and the TS mappers in
-- src/lib/ethics, src/lib/case-recusals, src/lib/action-items which all read HC000 as
-- "flag off"). HC000 is in the HC0xx class, so PostgREST returns 400 + {code,message}
-- (ADR 0018) — the client receives error.code = 'HC000'. The review's "pick a free
-- HC0Mx" suggestion is superseded: the HC0M0–HC0M9 block is full AND HC000 is the exact,
-- pre-existing convention for this meaning.
--
-- The function BODY below was rewritten from the LIVE catalog (pg_get_functiondef),
-- never from migration file text (CLAUDE.md binding rule / ADR 0078 A28). Only the
-- errcode changes; the pt-BR message, volatility, and search_path are byte-identical.
-- Idempotent create-or-replace; no data touched (safe for a data-bearing db push).

create or replace function app.assert_case_corrections_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if not app.feature_enabled('case_corrections') then
    raise exception 'o recurso de correção de casos não está disponível'
      using errcode = 'HC000';
  end if;
end;
$function$;
