-- =============================================================================
-- F-cleanup · D11 · G2 — anglicize status-enum internal keys:
--   #3 case_narratives.status       : aberta→open, concluida→completed
--   #4 indicator_measurements.status : na_meta→on_target, fora_da_meta→off_target,
--                                      sem_dados→no_data
--      (#4 keys ALSO surface as RETURNS TABLE output column names in the two
--       measurement-summary functions → renamed here; queries/indicators.ts + the
--       generated types follow.)
--
-- SHARED-LITERAL DISCIPLINE (concluida also lives in capa_action / case_interviews /
-- case_referral / case_phases — G3/G5/G6): the narrative WRITE sites are anchored by
-- the adjacent `concluded_at` column (case_interviews uses `completed_at`, phases have
-- no such column), so the context-anchored replace `'concluida', concluded_at` touches
-- ONLY narrative writes. `aberta` and all #4 keys are UNIQUE to their enum.
--
-- Method: explicit CHECK + default ALTERs, then a programmatic catalog rewrite over
-- normal functions (prokind='f'; pg_get_functiondef ERRORS on aggregates) + partial
-- indexes. Reset-OK: empty DB at migration time.
-- =============================================================================

-- --- CHECK constraints + defaults -------------------------------------------
alter table public.case_narratives alter column status set default 'open';
alter table public.case_narratives drop constraint if exists case_narratives_status_check;
alter table public.case_narratives add constraint case_narratives_status_check
  check (status = any (array['open', 'completed']));

alter table public.indicator_measurements alter column status set default 'no_data';
alter table public.indicator_measurements drop constraint if exists indicator_measurements_status_check;
alter table public.indicator_measurements add constraint indicator_measurements_status_check
  check (status in ('on_target', 'off_target', 'no_data'));

-- --- Programmatic catalog rewrite (RAW search/replace pairs) -----------------
do $d11g2$
declare
  -- Each pair is a RAW substring (already quoted / already an identifier phrase).
  v_pairs text[] := array[
    -- case_narratives: aberta is UNIQUE to narratives. `concluida` is SHARED with
    -- conclude_interview (G3) / conclude_referral (G5) — they use the SAME
    -- `concluded_at` columns — so narrative `concluida` is NOT anchored here; it is
    -- rewritten in the conclude_narrative-scoped block below (function-scoped).
    $s$'aberta'$s$,                  $s$'open'$s$,
    -- indicator_measurements status literals (unique). The RETURNS TABLE output
    -- column identifiers (na_meta bigint …) are renamed separately below — a column
    -- rename is a return-TYPE change, which CREATE OR REPLACE rejects (42P13).
    $s$'na_meta'$s$,      $s$'on_target'$s$,
    $s$'fora_da_meta'$s$, $s$'off_target'$s$,
    $s$'sem_dados'$s$,    $s$'no_data'$s$
  ];
  i int;
  v_old text;
  v_new text;
  r record;
  v_def text;
begin
  i := 1;
  while i < array_length(v_pairs, 1) loop
    v_old := v_pairs[i];
    v_new := v_pairs[i + 1];

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

    -- partial indexes (predicate literals only; identifier pairs harmlessly never match)
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
$d11g2$;

-- --- case_narratives `concluida` → `completed`, scoped to NARRATIVE-PURE functions
--     (conclude_narrative WRITE + reopen_narrative guard). `concluida` is SHARED with
--     conclude_interview (G3) / conclude_referral (G5) / case_phases (G6), which use the
--     SAME concluded_at columns, so we rewrite it ONLY in functions that reference
--     case_narratives and NONE of the other status-enum tables — excluding the shared
--     conclude functions and multi-table readers. All narrative functions RETURN void →
--     CREATE OR REPLACE is fine.
do $d11g2nar$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public') and p.prokind = 'f'
  loop
    v_def := pg_get_functiondef(r.oid);
    if position($s$'concluida'$s$ in v_def) > 0
       and position('case_narratives' in v_def) > 0
       and position('case_interviews' in v_def) = 0
       and position('case_referral'  in v_def) = 0
       and position('case_phases'     in v_def) = 0
    then
      execute replace(v_def, $s$'concluida'$s$, $s$'completed'$s$);
    end if;
  end loop;
end
$d11g2nar$;

-- --- #4 RETURNS TABLE output-column rename (na_meta/fora_da_meta/sem_dados →
--     on_target/off_target/no_data) on the two measurement-summary readers. This is a
--     return-type change → DROP + re-CREATE (grants re-applied; bodies were already
--     anglicized by the pass above). queries/indicators.ts reads these field names.
do $d11g2fn$
declare
  v_targets text[] := array['public.indicator_kpis(uuid)', 'public.hospital_indicator_rollup(uuid)'];
  v_sig text;
  v_def text;
begin
  foreach v_sig in array v_targets loop
    v_def := pg_get_functiondef(v_sig::regprocedure);
    v_def := replace(v_def, 'na_meta bigint',      'on_target bigint');
    v_def := replace(v_def, 'fora_da_meta bigint', 'off_target bigint');
    v_def := replace(v_def, 'sem_dados bigint',    'no_data bigint');
    execute format('drop function %s', v_sig);
    execute v_def;
    execute format('revoke all on function %s from public', v_sig);
    execute format('grant execute on function %s to authenticated, service_role', v_sig);
  end loop;
end
$d11g2fn$;
