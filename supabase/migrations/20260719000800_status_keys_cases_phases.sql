-- =============================================================================
-- F-cleanup · D11 · G6 — anglicize status-enum internal keys (the FINAL, coupled pair):
--   #11 cases.status       : nao_iniciado→not_started, pendente→pending,
--                            em_revisao→in_review, concluido→completed, cancelado→cancelled
--   #12 case_phases.status : pendente→pending, ativa→active, concluida→completed,
--                            nao_necessaria→not_required
--
-- MUST be ONE migration: cases.status is RECOMPUTED from case_phases.status by
-- app.recompute_case_status (bool_or(status='ativa'/'concluida') …), and the case
-- terminal gate ('concluido','cancelado') appears across ~15 RPCs + the
-- cases_closed_at_paired table CHECK — the two enums cannot be split without a
-- transient inconsistency.
--
-- Internal stored keys only (NOT user-facing labels — Rule 10 pt-BR values stay).
-- Reset-OK: migrations apply to an empty DB (seed runs after) — no data backfill.
--
-- NO SCOPING NEEDED (G6 is the LAST group). Every G6 literal was, until now, potentially
-- shared — but every other owner has already been anglicized: pendente (capa_action→G3),
-- concluida (capa_action/interviews→G3, narratives→G2, referral→G5), concluido/cancelado
-- (capa_plan→G3). Verified against the live catalog: the ONLY functions still carrying any
-- G6 literal are cases/case_phases functions (incl. the blank-table guard_case_phase_status).
-- So a blanket catalog rewrite — apply the full G6 map to every function whose def actually
-- changes — cannot touch another enum. No partial indexes / views / RETURNS TABLE output
-- columns carry a G6 literal (verified against the live catalog).
--
-- Method: explicit CHECK + default ALTERs (incl. the cases_closed_at_paired terminal
-- gate), then a programmatic catalog rewrite over normal functions (prokind='f';
-- pg_get_functiondef ERRORS on aggregates → fetch the def INSIDE the loop).
-- =============================================================================

-- --- CHECK constraints + column defaults (explicit) -------------------------
-- cases: status vocabulary + the closed_at pairing gate (references the terminal keys).
alter table public.cases alter column status set default 'not_started';
alter table public.cases drop constraint if exists cases_status_check;
alter table public.cases add constraint cases_status_check
  check (status = any (array['not_started', 'pending', 'in_review', 'completed', 'cancelled']));
alter table public.cases drop constraint if exists cases_closed_at_paired;
alter table public.cases add constraint cases_closed_at_paired
  check ((status <> all (array['completed', 'cancelled'])) or (closed_at is not null));

-- case_phases: pending / active / completed / not_required.
alter table public.case_phases alter column status set default 'pending';
alter table public.case_phases drop constraint if exists case_phases_status_check;
alter table public.case_phases add constraint case_phases_status_check
  check (status = any (array['pending', 'active', 'completed', 'not_required']));

-- --- Programmatic catalog rewrite — blanket (only cases/phase fns carry G6 keys) ---
do $d11g6$
declare
  v_pairs text[] := array[
    'nao_iniciado',   'not_started',
    'pendente',       'pending',
    'em_revisao',     'in_review',
    'concluido',      'completed',
    'cancelado',      'cancelled',
    'ativa',          'active',
    'concluida',      'completed',
    'nao_necessaria', 'not_required'
  ];
  r record;
  v_def text;
  v_orig text;
  i int;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.prokind = 'f'      -- exclude aggregates: pg_get_functiondef raises on them
  loop
    v_def := pg_get_functiondef(r.oid);
    v_orig := v_def;
    i := 1;
    while i < array_length(v_pairs, 1) loop
      v_def := replace(v_def, quote_literal(v_pairs[i]), quote_literal(v_pairs[i + 1]));
      i := i + 2;
    end loop;
    if v_def <> v_orig then
      execute v_def;   -- CREATE OR REPLACE with English keys (all G6 fns return void/scalar/table/trigger)
    end if;
  end loop;
end
$d11g6$;
