-- =============================================================================
-- F-cleanup · D11 · G3 — anglicize status-enum internal keys (3 coupled enums):
--   #5 capa_action.status    : pendente→pending, em_andamento→in_progress,
--                              concluida→completed, cancelada→cancelled
--   #6 case_interviews.status : rascunho→draft, agendada→scheduled,
--                              em_andamento→in_progress, concluida→completed,
--                              cancelada→cancelled
--   #7 capa_plan.status      : aberto→open, em_execucao→in_execution,
--                              em_verificacao→in_verification, concluido→completed,
--                              cancelado→cancelled
--
-- Internal stored keys only (NOT user-facing labels — Rule 10 pt-BR values stay).
-- Reset-OK: migrations apply to an empty DB (seed runs after) — no data backfill.
--
-- SHARED-LITERAL DISCIPLINE (the failure mode). Every G3 literal except the four
-- G3-unique ones (aberto/em_execucao/em_verificacao — capa_plan-only — and
-- em_andamento, fully contained in capa_action+case_interviews) is SHARED with a
-- NOT-yet-converted enum:
--   concluida → case_referral(G5), case_phases(G6)   cancelada → meetings(G5)
--   concluido → cases(G6)                            cancelado → cases(G6)
--   pendente  → cases/case_phases(G6)                rascunho  → controlled_docs(G4),
--   agendada  → meetings(G5)                                     case_referral(G5)
-- So a blanket replace is UNSAFE. Instead we compute the G3 FUNCTION SET and apply
-- the full G3 map only to it. The set = functions that reference a G3 OWN table
-- (capa_action|case_interviews|capa_plan) OR are the blank-table G3 status guards
-- (guard_capa_status = capa_plan, guard_interview_status = case_interviews) AND that
-- reference NONE of the conflicting tables (case_referral|cases|case_phases|meetings|
-- controlled_document*). Verified against the live catalog: the only functions that
-- reference BOTH a G3 table and a conflicting table (create_interview, dispose_case_phi,
-- _audit_access_authorized) carry NO status literal, so excluding them loses nothing;
-- and no literal-bearing G3 function references a conflicting table. The blank-table
-- G6 guard guard_case_phase_status ALSO carries 'concluida'/'pendente' — it is excluded
-- precisely because it is neither a G3-table function nor a named G3 guard.
--
-- Method: explicit CHECK + default ALTERs, then a programmatic catalog rewrite over
-- normal functions (prokind='f'; pg_get_functiondef ERRORS on aggregates → fetch the
-- def INSIDE the loop, never in the WHERE). No partial indexes / views / RETURNS TABLE
-- output columns carry any G3 literal (verified against the live catalog), so no
-- index rebuild and no DROP+CREATE (42P13) is needed here.
-- =============================================================================

-- --- CHECK constraints + column defaults (explicit) -------------------------
alter table public.capa_action alter column status set default 'pending';
alter table public.capa_action drop constraint if exists capa_action_status_check;
alter table public.capa_action add constraint capa_action_status_check
  check (status = any (array['pending', 'in_progress', 'completed', 'cancelled']));

alter table public.case_interviews alter column status set default 'draft';
alter table public.case_interviews drop constraint if exists case_interviews_status_check;
alter table public.case_interviews add constraint case_interviews_status_check
  check (status = any (array['draft', 'scheduled', 'in_progress', 'completed', 'cancelled']));

alter table public.capa_plan alter column status set default 'open';
alter table public.capa_plan drop constraint if exists capa_plan_status_check;
alter table public.capa_plan add constraint capa_plan_status_check
  check (status = any (array['open', 'in_execution', 'in_verification', 'completed', 'cancelled']));

-- --- Programmatic catalog rewrite — G3 function set × full G3 map ------------
do $d11g3$
declare
  -- old → new (quoted at apply time). Applied ONLY to G3-owned functions, so the
  -- fem/masc collisions (concluida/concluido→completed; cancelada/cancelado→cancelled)
  -- and the em_* family are unambiguous within this set.
  v_pairs text[] := array[
    'pendente',       'pending',
    'em_andamento',   'in_progress',
    'concluida',      'completed',
    'cancelada',      'cancelled',
    'rascunho',       'draft',
    'agendada',       'scheduled',
    'aberto',         'open',
    'em_execucao',    'in_execution',
    'em_verificacao', 'in_verification',
    'concluido',      'completed',
    'cancelado',      'cancelled'
  ];
  r record;
  v_def text;
  v_orig text;
  i int;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.prokind = 'f'      -- exclude aggregates: pg_get_functiondef raises on them
  loop
    v_def := pg_get_functiondef(r.oid);

    -- INCLUSION: references a G3 own table, or is a named blank-table G3 guard.
    -- EXCLUSION: references any not-yet-converted enum table that shares a literal.
    if ( v_def ~ '\y(capa_action|case_interviews|capa_plan)\y'
         or r.proname in ('guard_capa_status', 'guard_interview_status') )
       and v_def !~ '\y(case_referral|cases|case_phases|meetings)\y'
       and position('controlled_document' in v_def) = 0
    then
      v_orig := v_def;
      i := 1;
      while i < array_length(v_pairs, 1) loop
        v_def := replace(v_def, quote_literal(v_pairs[i]), quote_literal(v_pairs[i + 1]));
        i := i + 2;
      end loop;
      if v_def <> v_orig then
        execute v_def;   -- CREATE OR REPLACE with English keys (all G3 fns RETURN void/scalar/trigger)
      end if;
    end if;
  end loop;
end
$d11g3$;
