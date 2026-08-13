-- =============================================================================
-- F-cleanup · D11 · G5 — anglicize status-enum internal keys (2 coupled enums):
--   #9  case_referral.status : rascunho→draft, enviada→sent, recebida→received,
--                              aceita→accepted, recusada→rejected, em_analise→in_review,
--                              concluida→completed, retirada→withdrawn
--   #10 meetings.status      : agendada→scheduled, realizada→held,
--                              em_assinatura→in_signature, assinada→signed,
--                              distribuida→distributed, cancelada→cancelled
--
-- Internal stored keys only (NOT user-facing labels — Rule 10 pt-BR values stay).
-- Reset-OK: migrations apply to an empty DB (seed runs after) — no data backfill.
--
-- SHARED-LITERAL DISCIPLINE. By the time G5 runs (after G3+G4) every G5 literal EXCEPT
-- `concluida` is effectively enum-UNIQUE: `rascunho`'s other owners (case_interviews,
-- controlled_documents) are already English; `agendada`/`cancelada`'s other owners
-- (case_interviews, capa_action) are already English. `concluida` alone is STILL SHARED
-- with case_phases (G6). Verified against the live catalog: the referral/meeting
-- function set and the case_phases `concluida` function set are DISJOINT — the only
-- `concluida`-bearing functions that reference case_referral are conclude_referral /
-- set_referral_patient / guard_referral_status (all referral-`concluida`, none touch
-- case_phases); the entangled multi-table functions (close_case, get_member_overview,
-- link_referral_case) carry ONLY unique referral/meeting literals, no `concluida`. As a
-- belt-and-suspenders the `concluida`→`completed` replace is additionally guarded to
-- skip any function that references case_phases.
--
-- Two blank/cases-only guards do NOT name their own table in the body and so are
-- included BY NAME: guard_referral_status (references `cases`, not `case_referral`),
-- guard_meeting_status (blank), plus add_referral_reply_attachment (blank).
--
-- Method: explicit CHECK + default ALTERs, then a programmatic catalog rewrite over
-- normal functions (prokind='f'; pg_get_functiondef ERRORS on aggregates → fetch the
-- def INSIDE the loop). No partial indexes / views / RETURNS TABLE output columns carry
-- any G5 literal (verified against the live catalog).
-- =============================================================================

-- --- CHECK constraints + column defaults (explicit) -------------------------
alter table public.case_referral alter column status set default 'draft';
alter table public.case_referral drop constraint if exists case_referral_status_check;
alter table public.case_referral add constraint case_referral_status_check
  check (status = any (array['draft', 'sent', 'received', 'accepted', 'rejected',
                             'in_review', 'completed', 'withdrawn']));

alter table public.meetings alter column status set default 'scheduled';
alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings add constraint meetings_status_check
  check (status = any (array['scheduled', 'held', 'in_signature', 'signed',
                             'distributed', 'cancelled']));

-- --- Programmatic catalog rewrite — referral+meetings function set × G5 map ---
do $d11g5$
declare
  -- UNIQUE G5 literals (safe to blanket within the G5 function set).
  v_uniq text[] := array[
    'rascunho',      'draft',
    'enviada',       'sent',
    'recebida',      'received',
    'aceita',        'accepted',
    'recusada',      'rejected',
    'em_analise',    'in_review',
    'retirada',      'withdrawn',
    'agendada',      'scheduled',
    'realizada',     'held',
    'em_assinatura', 'in_signature',
    'assinada',      'signed',
    'distribuida',   'distributed',
    'cancelada',     'cancelled'
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

    -- INCLUSION: references a G5 own table, or is one of the blank/cases-only G5 fns.
    if ( v_def ~ '\y(case_referral|meetings)\y'
         or r.proname in ('guard_referral_status', 'guard_meeting_status',
                          'add_referral_reply_attachment') )
    then
      v_orig := v_def;
      i := 1;
      while i < array_length(v_uniq, 1) loop
        v_def := replace(v_def, quote_literal(v_uniq[i]), quote_literal(v_uniq[i + 1]));
        i := i + 2;
      end loop;

      -- 'concluida' is SHARED with case_phases (G6): convert ONLY where the function
      -- does not reference case_phases (guards the referral 'concluida' without ever
      -- touching a phase 'concluida').
      if position('case_phases' in v_def) = 0 then
        v_def := replace(v_def, quote_literal('concluida'), quote_literal('completed'));
      end if;

      if v_def <> v_orig then
        execute v_def;
      end if;
    end if;
  end loop;
end
$d11g5$;
