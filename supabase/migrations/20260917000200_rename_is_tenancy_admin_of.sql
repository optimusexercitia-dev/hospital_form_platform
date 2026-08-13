-- RENAME app.is_commission_admin_of(_for) → app.is_tenancy_admin_of(_for).
--
-- PO-approved 2026-08-08, deliberately deferred until after QO·B so it could not confound
-- that phase's equivalence matrix; re-confirmed 2026-08-09 and sequenced LAST of the three
-- waves so it sweeps a catalog that has stopped moving.
--
-- WHY. The name is a lie and has been since ADR 0041. `is_commission_admin_of` resolves
-- **org_admin / hospital_admin** — the TENANCY tier — and is FALSE for `staff_admin`, the
-- actual commission administrator. Every reader of this predicate has to be told that, and
-- QO·B's inventory had to say it out loud in a dozen places. A predicate whose name asserts
-- the opposite of its meaning is the same class of hazard this repo keeps filing bugs about,
-- just spelled in an identifier instead of a comment.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE MECHANISM, measured before this file was written (it is NOT what the D11 lesson
-- would predict, and getting it wrong in either direction is expensive):
--
--   · pg_policy stores a PARSED node tree that references the function by **OID**. A rename
--     is therefore transparent to every policy — `pg_get_expr` renders the new name the
--     instant ALTER FUNCTION returns. Probed live: `forms_select` went from
--     `app.is_commission_admin_of(commission_id)` to `app.is_tenancy_admin_of(commission_id)`
--     with no policy edit at all. **All 54 policies need zero changes.**
--   · pg_proc.prosrc is PLAIN TEXT. Function bodies do NOT follow, and after the rename each
--     one names a function that no longer exists. **Every body must be rewritten.**
--
-- ⚠ Do not import the D11 lesson here. That failure ("the re-key rewrote pg_proc only, never
-- pg_policy, and failed CLOSED so nothing caught it") was an ENUM re-key: enum labels are
-- string LITERALS inside a predicate, so policies did not follow. A function identifier
-- resolves to an OID, so policies DO follow. Same-shaped task, opposite mechanism — which is
-- exactly why this was measured instead of assumed.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- POPULATION is derived from the catalog AT RUNTIME, never transcribed and never counted
-- into a constant: the two preceding waves already moved the number (77 → 75) and any
-- hardcoded figure would have been stale before this file ran. The postcondition asserts
-- ZERO remaining references, which is correspondence rather than arithmetic — it cannot be
-- satisfied by an off-by-one.
--
-- NO SHIM (PO ruling 2026-08-09): the old name is gone, not aliased. Anything missed fails
-- loudly here rather than resolving quietly for another six months.
--
-- ORDER MATTERS: the ALTERs come FIRST. A `LANGUAGE sql` body is validated at CREATE, so a
-- body rewritten to name `is_tenancy_admin_of` only compiles once that function exists.

-- ── 1 · rename the two objects. Policies follow automatically (see above). ────
alter function app.is_commission_admin_of(uuid) rename to is_tenancy_admin_of;
alter function app.is_commission_admin_of_for(uuid, uuid) rename to is_tenancy_admin_of_for;

-- ── 2 · rewrite every body that names the old identifier. ────────────────────
-- A plain substring replace is CORRECT for both variants and that is not luck: the `_for`
-- suffix is preserved by replacing the shared stem, so `is_commission_admin_of_for` becomes
-- `is_tenancy_admin_of_for` in the same pass. (A `\y`-anchored replace would have matched
-- only the bare name — the word boundary fails before `_` — and would have left every `_for`
-- call site pointing at a dead function. That exact blindness has already cost this repo a
-- corrected sweep.)
--
-- Iterating by OID, which survives the rename. Comments inside bodies are rewritten too,
-- deliberately: a comment naming a function that no longer exists is the stale-assertion
-- hazard, not documentation.
do $rewrite$
declare
  r record;
  v_def text;
  v_n int := 0;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_language l on l.oid = p.prolang
     where p.prosrc ~ 'is_commission_admin_of'
       and l.lanname in ('plpgsql', 'sql')
     order by p.oid
  loop
    v_def := replace(pg_get_functiondef(r.oid),
                     'is_commission_admin_of', 'is_tenancy_admin_of');
    execute v_def;
    v_n := v_n + 1;
  end loop;
  raise notice 'RENAME: rewrote % function bodies', v_n;
end
$rewrite$;

-- ── 3 · POSTCONDITION — correspondence, not arithmetic. ──────────────────────
do $post$
declare
  v_leak text;
  v_pol  int;
begin
  -- (a) The new objects must EXIST. Without this the whole file could "succeed" by
  --     having deleted the predicate, and every assertion below would pass vacuously.
  if to_regprocedure('app.is_tenancy_admin_of(uuid)') is null then
    raise exception 'RENAME postcondition: app.is_tenancy_admin_of(uuid) does not exist';
  end if;
  if to_regprocedure('app.is_tenancy_admin_of_for(uuid, uuid)') is null then
    raise exception 'RENAME postcondition: app.is_tenancy_admin_of_for(uuid, uuid) does not exist';
  end if;

  -- (b) The OLD objects must be GONE — no shim, per the ruling.
  if to_regprocedure('app.is_commission_admin_of(uuid)') is not null
     or to_regprocedure('app.is_commission_admin_of_for(uuid, uuid)') is not null then
    raise exception 'RENAME postcondition: the old predicate still exists — this wave rules out a shim';
  end if;

  -- (c) ZERO references left anywhere in pg_proc, in ANY language. Note the domain is
  --     deliberately WIDER than the rewrite loop's (which filtered to plpgsql/sql): if a
  --     function in some other language names the old identifier, this must fail rather
  --     than let the loop's own filter define what counts as complete.
  select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname) into v_leak
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosrc ~ 'is_commission_admin_of';
  if v_leak is not null then
    raise exception 'RENAME postcondition: function(s) still name the old predicate: %', v_leak;
  end if;

  -- (d) ZERO references left in any policy expression.
  select string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname) into v_leak
    from pg_policies
   where (coalesce(qual, '') || coalesce(with_check, '')) ~ 'is_commission_admin_of';
  if v_leak is not null then
    raise exception 'RENAME postcondition: policy(ies) still name the old predicate: %', v_leak;
  end if;

  -- (e) THE NON-VACUITY CHECK, and the one that actually earns its keep. (c) and (d) are
  --     both satisfiable by DELETION — drop every caller and they pass. So assert the
  --     authorization surface is still THERE under the new name: the 54 policies that
  --     rendered the old predicate must now render the new one. A rename that silently
  --     stripped the tenancy arm from the platform would sail through (a)–(d).
  select count(*) into v_pol
    from pg_policies
   where (coalesce(qual, '') || coalesce(with_check, '')) ~ 'is_tenancy_admin_of';
  if v_pol <> 54 then
    raise exception 'RENAME postcondition: % policies render the new predicate, expected the 54 that rendered the old one — the arm moved, it must not have been lost', v_pol;
  end if;

  raise notice 'RENAME postcondition: OK — old name absent from pg_proc and pg_policies; % policies carry the new predicate', v_pol;
end
$post$;
