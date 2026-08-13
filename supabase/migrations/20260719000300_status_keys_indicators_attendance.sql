-- =============================================================================
-- F-cleanup · D11 · G1 — anglicize status-enum internal keys (2 low-risk enums):
--   #1 indicators.status         : ativo→active, arquivado→archived
--   #2 meeting_attendees.attendance: convocado→summoned, presente→present,
--                                    ausente→absent, justificado→excused
--
-- Internal stored keys only (NOT user-facing labels — Rule 10 pt-BR values stay).
-- Spelling locked against existing English schema keys (docs/plans/f-cleanup-d11.md).
-- Reset-OK: migrations apply to an empty DB (seed runs after) — no data backfill.
--
-- Method: explicit ALTER for CHECK + column default; then a PROGRAMMATIC pass over
-- the live catalog (pg_get_functiondef / pg_get_indexdef + scoped quoted-literal
-- replace) so EVERY function body / partial index carrying the key is rewritten —
-- the "missed compare site" failure mode is eliminated by construction (the ADR-0051
-- catalog-rewrite precedent). All G1 literals are UNIQUE to their enum, so the
-- scoped replace cannot touch another enum's rows.
-- =============================================================================

-- --- CHECK constraints + column defaults (explicit) -------------------------
alter table public.indicators alter column status set default 'active';
alter table public.indicators drop constraint if exists indicators_status_check;
alter table public.indicators add constraint indicators_status_check
  check (status in ('active', 'archived'));

alter table public.meeting_attendees alter column attendance set default 'summoned';
alter table public.meeting_attendees drop constraint if exists meeting_attendees_attendance_check;
alter table public.meeting_attendees add constraint meeting_attendees_attendance_check
  check (attendance = any (array['summoned', 'present', 'absent', 'excused']));

-- --- Programmatic catalog rewrite (functions + partial indexes) --------------
do $d11g1$
declare
  v_pairs text[] := array[
    'ativo',        'active',
    'arquivado',    'archived',
    'convocado',    'summoned',
    'presente',     'present',
    'ausente',      'absent',
    'justificado',  'excused'
  ];
  i int;
  v_old text;   -- the quoted old literal, e.g. 'ativo'
  v_new text;   -- the quoted new literal, e.g. 'active'
  r record;
  v_def text;
begin
  i := 1;
  while i < array_length(v_pairs, 1) loop
    v_old := quote_literal(v_pairs[i]);
    v_new := quote_literal(v_pairs[i + 1]);

    -- Normal functions only (prokind='f'): pg_get_functiondef ERRORS on aggregate/
    -- window functions, so never call it in a WHERE clause over all of pg_proc.
    -- Fetch the def INSIDE the loop and test the literal there.
    for r in
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('app', 'public')
        and p.prokind = 'f'
    loop
      v_def := pg_get_functiondef(r.oid);
      if position(v_old in v_def) > 0 then
        execute replace(v_def, v_old, v_new);
      end if;
    end loop;

    -- Plain partial indexes carrying the literal in their predicate. Skip
    -- constraint-backed indexes (dropped via their constraint, not DROP INDEX).
    for r in
      select n.nspname as sch, c.relname as nm, pg_get_indexdef(i2.indexrelid) as def
      from pg_index i2
      join pg_class c on c.oid = i2.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('app', 'public')
        and not exists (select 1 from pg_constraint k where k.conindid = i2.indexrelid)
        and pg_get_indexdef(i2.indexrelid) like '%' || v_old || '%'
    loop
      execute format('drop index %I.%I', r.sch, r.nm);
      execute replace(r.def, v_old, v_new);
    end loop;

    i := i + 2;
  end loop;
end
$d11g1$;
