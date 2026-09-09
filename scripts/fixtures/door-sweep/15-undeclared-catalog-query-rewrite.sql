-- One of the 25 UNREADABLE rewrites the deriver's 4b block admits it can never reach: the
-- house pattern (`pg_get_functiondef` + `replace()` + `execute`) picking its targets by a
-- CATALOG QUERY at apply time, with no marker declaration, no array literal and no
-- `create or replace function` line. Nothing here names a door.
-- ⛔ NEGATIVE CONTROL. This file must stay a FINDING (1) forever — including when it shares
--   a range with a migration that DOES declare its targets. Aggregating resolvability across
--   files let a declaring sibling mask it.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and pg_get_functiondef(p.oid) ~ 'coalesce\(app\.is_admin\(\), false\)'
  loop
    execute replace(pg_get_functiondef(r.sig), 'false)', 'false) /* re-keyed */');
  end loop;
end $$;
