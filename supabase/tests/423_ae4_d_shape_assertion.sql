-- 423 — AE4-D-SHAPE-ASSERTION: ADR 0208 D2's six-clause shape assertion on the candidate fan-out.
-- Subject: the LIVE bodies of authz.authorized_scope_ids / authz.candidate_authorized_scope_ids and
-- the provider family they consume. ⛔ NO migration, NO catalog change, NO producer factoring — the
-- unit's opening decision (docs/progress/ae4-d-shape-assertion.md); this file only measures.
--
-- D1 is the invariant asserted: `D ≤ F` and `Dₖ ≤ min(F, |scopesₖ|)` over a provider-neutral fact
-- set — a PARAMETRIC STRUCTURAL INVARIANT plus accepted operational risk. ⛔ Never "large D is
-- unreachable", ⛔ never a numeric ceiling: nothing below pins a maximum, and a cell that did would
-- be asserting the fixture rather than the shape.
--
-- ⭐ WRITTEN RED-FIRST. Every section carries a PLANT — a mutant built by ANCHORED SURGERY on the
-- live definition inside a savepoint — and the red it produced is recorded in the unit's progress
-- record before the green was accepted. A cell with no way to go red is not evidence.
--
-- ============================================================================================
-- THE THREE INSTRUMENTS, AND WHY NONE OF THEM IS A COPY OF PRODUCTION TEXT
-- --------------------------------------------------------------------------------------------
--   I1  PRODUCER-EXTRACTED.  `pg_temp.cte(sig)` cuts the candidate CTE out of
--       `pg_get_functiondef(sig)` with one anchored regex and RAISES — never returns empty — when
--       the anchor moves. `pg_temp.pcount(...)` substitutes the parameters BY NAME (checking each
--       expected name was found, else RAISE) and EXECUTES that text, optionally with the
--       deduplication token removed (again: RAISE if the token is absent).
--       ⛔⛔ THIS IS NOT ADR 0183 `:114-115`'s FORBIDDEN HAND-COPY, and the difference is the whole
--       reason it is allowed here. What 0183 rejects is "a harness holding a copy of production
--       text… a duplicate no gate protects", written once and left to drift away from the body it
--       duplicates. Nothing here is written down: the text is re-read from `pg_proc` on EVERY run,
--       so it cannot drift by construction, and every anchor it depends on raises rather than
--       silently matching nothing. A hand copy is green while production changes underneath it;
--       this is red the moment its anchors move.
--       ⚠ And on its own it proves NOTHING — it runs production text, so it agrees with production
--       trivially. It is only evidence AGAINST I2.
--
--   I2  FACT × REACH, the independent derivation.  `authz.assignment_facts(p)` joined to every
--       scope of the kind through the LIVE predicate `authz.scope_reaches(...)`:
--       `raw = count(*)`, `D = count(distinct scope_id)`.
--       ⭐ WHY THIS EXISTS AT ALL: the candidate CTE does NOT call `authz.scope_reaches` — it
--       carries its own inline `CASE`, which is the PROJECTION form of that PREDICATE. The ascent
--       therefore lives TWICE in the catalog, on opposite sides of the resolver (the producer's
--       CASE; `scope_reaches`, called by `authz.entailed_grants` on the confirm side). Comparing
--       the two is a real cross-check between two live production artifacts, not a restatement.
--       I2's own correctness is not assumed: pgTAP `412` pins `scope_reaches`' ascent against
--       `commissions_hospital_org_fkey`.
--
--   I3  THE P2 COUNTER (`pg_stat_get_function_calls` under `track_functions='all'`) — ⛔ NOT USED
--       IN THIS FILE, and that is measured, not preferred. See the AC-4 note below.
--
-- ============================================================================================
-- ⛔ AC-4: WHY `U` IS NOT MEASURED HERE. THIS FILE ASSERTS `D ≤ F`, NOT `U = D ≤ F`.
-- --------------------------------------------------------------------------------------------
-- Measured 2026-09-13 on this stack, one direct `authz.assignment_facts` call over M = 2 rows under
-- a per-session `track_functions = 'all'`:
--     inside `begin … rollback`, snapshot cleared                       Δ = 0
--     inside `begin … rollback`, plus `pg_stat_force_next_flush()`      Δ = 0
--     at TOP LEVEL, force flush + clear snapshot (ADR 0183's §0 recipe) Δ = 1   ✅
-- Pending function stats accumulate but are not published to the snapshot until transaction end,
-- and `pg_stat_force_next_flush()` does not change that. Every pgTAP file is ONE transaction, so
-- `U` is unreadable from inside one. The side-session escape (`dblink`, its own backend at top
-- level) was measured too and is CLOSED on this stack: `postgres` here is `rolsuper = f`, so
-- `dblink_connect` demands credentials the server actually used — over the unix socket it errors
-- `password or GSSAPI delegated credentials required`, and over TCP WITH the password it still
-- errors (`pg_hba` is trust, so the password is never consumed); `dblink_connect_u`'s ACL is
-- `supabase_admin=X/supabase_admin` and errors `permission denied`. Granting it would be a
-- migration, which this unit forbids, and requiring an `hba` change would be stack configuration
-- the test runner cannot guarantee.
-- ⇒ `U`'s ONE home is `scripts/authz-ae4-p2-invocation-count.sql § 5`, at top level on the loaded
--   AE4 perf fixture. ⛔ Nothing below may be read as a statement about the confirmation COUNT.
--
-- ============================================================================================
-- ⛔ THE SAVEPOINT TRAP (LESSONS; `421`/`422` state the mechanism). An assertion that RAISES inside
-- a savepoint is recovered by the following `rollback to savepoint` and silently never runs, and
-- its TAP line never reaches pg_prove. EVERY assertion in this file is made OUTSIDE every
-- savepoint. Each plant leaves its measurement on the one channel a rollback cannot reach —
-- `setval` on a temp sequence, which is NON-TRANSACTIONAL — and every probe is written as
-- `value + 1`, so **0 means THE BLOCK NEVER RAN**, a different and worse reading than "the probe
-- found nothing". ⛔ Do not tidy the +1 away.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` — same reason as `401`/`407`/`412`/`413`:
-- its subject is the real seeded tenancy population, which bootstrap's `truncate … cascade` would
-- destroy. Everything rolls back.
--
-- ⚠ IT MUST PASS AT SEED SCALE AND WITH THE AE4 PERF FIXTURE LOADED (413's requirement). The swept
-- population is a deterministic slice — principals with ≥ 1 fact, `order by id limit 40` — so the
-- file stays 120 cells instead of 36 108. ⛔ A bound that starts hiding the property is a FAILURE,
-- not a quiet pass: §1.2, §2.4, §3.3 and §4.3 RED when the slice loses a polarity.
--
-- ============================================================================================
-- WHAT THE NEIGHBOURING SUITES ALREADY HOLD, so no cell here restates one:
--   `413` — the subset invariant (set arm ⊆ `app.can_read_professional_profile`), the candidate
--           twin, and an over-broad-body vacuity control.  `412` — `scope_reaches`' ascent against
--           the FK.  `407` — scope-kind validation, with a deliberately FROZEN pre-change body as
--           its defect anchor.  NONE of them asserts `D ≤ F`, one-fact-one-candidate,
--           dedup-before-confirmation, the two CTEs' equality, or the provider family.
--
-- ⛔ WHAT THIS FILE DOES NOT PROVE, stated rather than left implicit:
--   1. Not `U`, and not execution ORDER. That deduplication happens BEFORE confirmation *in time*
--      is the script's measurement; §3 measures the SET-THEORETIC form of the same clause.
--   2. Not cost. Nothing here is a latency or a plan.
--   3. §1 is scoped to the CANDIDATE CTE. A fact-independent term in the CONFIRM select would not
--      be seen. ⛔ OUTPUT-level containment is deliberately NOT used as a producer test: the
--      CONFIRMER re-derives from the same facts and would filter a planted candidate regardless of
--      the producer, so such a cell is masked by a legitimately-closed arm and passes for a reason
--      unrelated to its subject.
--   4. §2's blind spot is an identical one-to-many expansion made in BOTH the producer's `CASE`
--      and `scope_reaches`. Either one alone reds (via §2.3's agreement cell, or via §2.1/§2.2).
--   5. §5 compares normalised TEXT. An equivalent re-spelling reds — a true signal under D2's "one
--      producer" reading — and a divergence hidden inside the body of a function both CTEs call by
--      the same name is invisible here.
--   6. §6's family is narrow BY DESIGN (schema `authz`, the provider argument list, the provider
--      row type). A provider in another schema, with a different arity, with a renamed or extra
--      column, spelled `setof <composite>`, consumed through a wrapper, or plumbed in as a VIEW is
--      MISSED. That bound is the price of a property that cannot false-RED on an unrelated
--      function, and widening it is exactly what ADR 0208 D3 trigger 2 asks a human to do.
--   7. Nothing here says the CONFIRMER is correct — that is `403`/`407`/`409`/`413`.
--
-- RUN SHAPE: `Files=2, Tests=34` (33 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a count
-- mismatch.

begin;
select plan(33);

-- ============================================================================
-- §0 — INSTRUMENTS, THE SWEPT POPULATION, AND THE CONTROLS ON BOTH.
-- ============================================================================

-- Every probe channel. Created BEFORE any savepoint so it survives every rollback.
-- 0 = THE BLOCK NEVER RAN.
create temp sequence s423_p1_mut  minvalue 0 start 0;  -- §1.4  pd under the fact-independent plant
create temp sequence s423_p1_abl  minvalue 0 start 0;  -- §1.4  pd under that plant WITH the principal ablated
create temp sequence s423_p1_real minvalue 0 start 0;  -- §1.3  pd on the REAL producer with the principal ablated
create temp sequence s423_p2_mut  minvalue 0 start 0;  -- §2.5  I2.raw under the one-to-many scope_reaches
create temp sequence s423_p3_mut  minvalue 0 start 0;  -- §3.4  pd under the dedup-removed producer
create temp sequence s423_p4_mut  minvalue 0 start 0;  -- §4.4  cells with pd <> rd under the arm-removed producer
create temp sequence s423_p5_cte  minvalue 0 start 0;  -- §5.3  is the extraction INSENSITIVE to the confirmer?
create temp sequence s423_p5_conf minvalue 0 start 0;  -- §5.3  §5.2's predicate under a swapped confirmer
create temp sequence s423_p5_mut  minvalue 0 start 0;  -- §5.4  CTE equality under a one-token change
create temp sequence s423_p6_size minvalue 0 start 0;  -- §6.3  provider-family size under the planted adapter
create temp sequence s423_p6_unc  minvalue 0 start 0;  -- §6.3  unconsumed providers under that plant

-- I1 — the extraction. RAISES rather than returning empty when its anchor moves.
create function pg_temp.cte(p_sig regprocedure) returns text language plpgsql as $cte$
declare v text;
begin
  v := substring(pg_get_functiondef(p_sig)
                 from 'with candidate as materialized \((.*)\)[^)]*select c\.scope_id');
  if v is null or v not like '%assignment_facts%' then
    raise exception 'CTE EXTRACTION FAILED for % — the anchor moved. FIX THE EXTRACTOR, do not widen it.', p_sig;
  end if;
  return v;
end $cte$;

create function pg_temp.cte_norm(p_sig regprocedure) returns text language plpgsql as $n$
begin
  -- `--` comments stripped and whitespace collapsed. ⛔ A RAW equality is NOT the comparator:
  -- measured, the two definitions differ on the signature, THREE `--` comment lines and the
  -- confirmer, so a raw test reds on the comments and proves nothing about the logic.
  return md5(regexp_replace(regexp_replace(pg_temp.cte(p_sig), '--[^\n]*', '', 'g'), '\s+', ' ', 'g'));
end $n$;

-- I1 — execute the extracted producer. Parameters bound BY NAME, each checked present.
create function pg_temp.pcount(p_sig regprocedure, p_principal uuid, p_kind text, p_dedup boolean)
returns bigint language plpgsql as $pc$
declare v text; n bigint;
begin
  v := pg_temp.cte(p_sig);
  if v !~ '\mp_principal\M' or v !~ '\mp_resolution_kind\M' then
    raise exception 'PARAMETER NAME NOT FOUND in the extracted CTE of % — the substitution would be silent.', p_sig;
  end if;
  v := regexp_replace(v, '\mp_principal\M', '$1', 'g');
  v := regexp_replace(v, '\mp_resolution_kind\M', '$2', 'g');
  if not p_dedup then
    if regexp_replace(v, 'select\s+distinct', 'select', '') = v then
      raise exception 'DEDUP TOKEN NOT FOUND in the extracted CTE of % — the pre-dedup variant is not constructible, so a silent raw = D would read as "no overlap".', p_sig;
    end if;
    v := regexp_replace(v, 'select\s+distinct', 'select', '');
  end if;
  execute format('with candidate as materialized (%s) select count(*) from candidate where scope_id is not null', v)
    into n using p_principal, p_kind;
  return n;
end $pc$;

-- The mutants are built from the LIVE definition by ANCHORED surgery, never hand-written, and the
-- surgery RAISES when its anchor is absent (so a plant that silently did nothing cannot be read as
-- a green — the probe stays 0, which every cell reports as THE BLOCK NEVER RAN).
create function pg_temp.surgery(p_sig regprocedure, p_find text, p_repl text) returns text language plpgsql as $s$
declare d text; m text;
begin
  d := pg_get_functiondef(p_sig);
  m := replace(d, p_find, p_repl);
  if m = d then raise exception 'SURGERY ANCHOR NOT FOUND in %: %', p_sig, p_find; end if;
  return m;
end $s$;

-- I2 — every scope, by kind. The three tenancy levels a resolution kind can name.
create temp view s423_scopes as
  select 'organization'::text as kind, o.id from public.organizations o
  union all select 'hospital', h.id from public.hospitals h
  union all select 'commission', c.id from public.commissions c;

-- The swept population, computed ONCE so every section reads the same numbers.
create temp table s423_cells on commit drop as
select p.id as pid, p.email, k.kind,
       (select count(*) from authz.assignment_facts(p.id))                                  as f,
       (select count(*) from authz.assignment_facts(p.id) af
          join s423_scopes s on s.kind = k.kind
         where authz.scope_reaches(af.scope_kind, af.scope_id, k.kind, s.id))                as rraw,
       (select count(distinct s.id) from authz.assignment_facts(p.id) af
          join s423_scopes s on s.kind = k.kind
         where authz.scope_reaches(af.scope_kind, af.scope_id, k.kind, s.id))                as rd,
       pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure, p.id, k.kind, true)  as pd,
       pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure, p.id, k.kind, false) as praw
  from (select id from public.profiles pr
         where exists (select 1 from authz.assignment_facts(pr.id))
         order by id limit 40) s
  join public.profiles p on p.id = s.id
  cross join (values ('organization'),('hospital'),('commission')) k(kind);

-- The definitions this file must leave exactly as it found them.
create temp table s423_def on commit drop as
  select f.sig, md5(pg_get_functiondef(f.sig)) as sum,
         case when f.sig::text like '%scope_reaches%' then null else pg_temp.cte_norm(f.sig) end as cten
    from (values ('authz.authorized_scope_ids(uuid,text,text)'::regprocedure),
                 ('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure),
                 ('authz.scope_reaches(text,uuid,text,uuid)'::regprocedure)) f(sig);

select ok(
  (select count(*) from s423_cells) between 3 and 120
  and (select count(*) from s423_cells where f > 0) = (select count(*) from s423_cells),
  format('0.1 FIXTURE CONTROL: the swept slice is non-empty and bounded — %s cells over %s principals '
         'x 3 kinds, every one with at least one provider fact. ⛔ An empty sweep makes every "≤" '
         'below true by having nothing to be true about.',
         (select count(*) from s423_cells), (select count(distinct pid) from s423_cells)));

select ok(
  pg_temp.cte('authz.authorized_scope_ids(uuid,text,text)'::regprocedure) like '%assignment_facts%'
  and pg_temp.cte('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure) like '%assignment_facts%'
  and pg_temp.cte('authz.authorized_scope_ids(uuid,text,text)'::regprocedure) not like '%has_permission%'
  and pg_temp.cte('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure) not like '%has_permission%',
  '0.2 EXTRACTION CONTROL: both cuts land on the PRODUCER — each contains the provider call and '
  'NEITHER contains a confirmer. ⛔ Load-bearing for §5: an extraction that swallowed the confirmer '
  'would make the equality cell red for a reason that has nothing to do with the candidate logic, '
  'and one that swallowed too little would make it green for the same kind of reason.');

select lives_ok(
  $$ select pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure,
       (select pid from s423_cells limit 1), 'organization', false) $$,
  '0.3 DEDUP TOKEN CONTROL: the pre-deduplication variant is CONSTRUCTIBLE, i.e. `select distinct` '
  'is really how the producer dedups. ⛔ If the dedup were re-spelled (a `group by`, an outer '
  '`distinct`), the replacement would be a silent no-op and `raw` would equal `D` everywhere — '
  '§3 would then read "no overlap anywhere" as a pass. pcount RAISES instead, and this cell is '
  'where that raise is caught.');

-- ============================================================================
-- §1 — CLAUSE 1: EVERY CANDIDATE ORIGINATES FROM AN ENTITLEMENT-PROVIDER FACT.
-- Asserted as containment in the fact-derived set, plus ABLATION: withdraw the principal's facts
-- at the provider (`app.is_active`, which BOTH legs of assignment_facts gate on) and the producer
-- must propose nothing.
-- ============================================================================

select is(
  (select count(*)::int from s423_cells where pd > rd),
  0,
  '1.1 ⭐ PROVENANCE: over every swept cell the producer proposes no more candidates than its own '
  'facts reach — `pd ≤ I2.D`. A candidate with no fact behind it breaks this; 1.4 plants exactly '
  'that and measures the red.');

select ok(
  (select count(*) from s423_cells where rd > 0) > 0,
  format('1.2 NON-VACUITY: %s of %s cells have a non-empty fact-derived candidate set. ⛔ "pd never '
         'exceeds rd" is satisfied for free by a population where both are 0 everywhere.',
         (select count(*) from s423_cells where rd > 0), (select count(*) from s423_cells)));

-- 1.3 — the ablation on the REAL producer. Measured inside a savepoint, asserted outside.
savepoint s423_ablate;
do $abl$
declare v_pid uuid; v_n bigint := 0;
begin
  select pid into v_pid from s423_cells where rd > 0 order by rd desc, pid limit 1;
  update public.profiles set is_active = false where id = v_pid;
  select coalesce(sum(pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure, v_pid, k, true)), 0)
    into v_n from unnest(array['organization','hospital','commission']) k;
  perform setval('s423_p1_real', v_n + 1);
end $abl$;
rollback to savepoint s423_ablate;

select is(
  (select last_value::int from s423_p1_real),
  1,
  '1.3 ⭐⭐ ABLATION ON THE REAL PRODUCER: with the subject principal made inactive — the one gate '
  'BOTH legs of authz.assignment_facts share — F drops to 0 and the producer proposes NOTHING at '
  'any of the three kinds (0 candidates, recorded as 0+1). ⛔ A value of 0 here means the ablation '
  'block never ran, which is a different and worse reading than "found nothing".');

-- 1.4 — RED-FIRST. A candidate that no fact produces, prepended to the live CTE by anchored surgery.
savepoint s423_plant1;
do $p1$
declare v_pid uuid;
begin
  select pid into v_pid from s423_cells where rd > 0 order by rd desc, pid limit 1;
  execute pg_temp.surgery('authz.authorized_scope_ids(uuid,text,text)'::regprocedure,
    'with candidate as materialized (',
    'with candidate as materialized ( select ''ffffffff-ffff-ffff-ffff-ffffffffffff''::uuid as scope_id union all');
  perform setval('s423_p1_mut',
    pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure, v_pid, 'organization', true) + 1);
  update public.profiles set is_active = false where id = v_pid;
  perform setval('s423_p1_abl',
    pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure, v_pid, 'organization', true) + 1);
end $p1$;
rollback to savepoint s423_plant1;

select ok(
  (select last_value from s423_p1_mut) > 1
  and (select last_value from s423_p1_mut) - 1
      > (select rd from s423_cells c where c.pid = (select pid from s423_cells where rd > 0 order by rd desc, pid limit 1)
                                       and c.kind = 'organization')
  and (select last_value from s423_p1_abl) = 2,
  format('1.4 ⭐⭐ 1.1 AND 1.3 RED-FIRST AGAINST A PLANTED CANDIDATE — the discrimination without '
         'which a 0 is just a number. With one fact-independent scope unioned into the LIVE CTE, '
         'the producer proposes %s (vs a fact-derived %s, so 1.1 reds) and still proposes %s with '
         'every fact withdrawn (so 1.3 reds). ⛔ Both probes read 0 if the plant block never ran.',
         (select last_value - 1 from s423_p1_mut),
         (select rd from s423_cells c where c.pid = (select pid from s423_cells where rd > 0 order by rd desc, pid limit 1)
                                        and c.kind = 'organization'),
         (select last_value - 1 from s423_p1_abl)));

select is(
  (select md5(pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure))),
  (select sum from s423_def where sig = 'authz.authorized_scope_ids(uuid,text,text)'::regprocedure),
  '1.5 RESTORE: authz.authorized_scope_ids is byte-identical to the definition captured before the '
  'plant. ⛔ Restored BY ROLLBACK, never from a hand copy.');

-- ============================================================================
-- §2 — CLAUSE 2: ONE FACT YIELDS AT MOST ONE CANDIDATE FOR A FIXED RESOLUTION KIND.
-- Measured PRE-deduplication on both artifacts, so a one-to-many expansion cannot hide behind the
-- `distinct`. This is ADR 0208 D3 trigger 3's watch, and it is a CELL here, not prose.
-- ============================================================================

select is(
  (select count(*)::int from s423_cells where praw > f),
  0,
  '2.1 ⭐ THE PRODUCER: its PRE-DEDUPLICATION candidate count never exceeds F, the provider''s own '
  'fact count. This is the `D ≤ F` derivation''s load-bearing half — `distinct` can only shrink a '
  'set, so raw ≤ F is what makes D ≤ F structural rather than incidental.');

select is(
  (select count(*)::int from s423_cells where rraw > f),
  0,
  '2.2 THE REACH PREDICATE: one fact reaches at most one scope per kind through authz.scope_reaches '
  'either. ⛔ Asserted separately from 2.1 because they are two artifacts: 2.5 breaks THIS one.');

select is(
  (select count(*)::int from s423_cells where praw <> rraw),
  0,
  '2.3 ⭐⭐ THE TWO LIVE ARTIFACTS AGREE, cell by cell. The producer''s inline CASE and '
  'authz.scope_reaches are two copies of the same ascent sitting on opposite sides of the resolver, '
  'and nothing else in the tree compares them. ⛔ This is what makes 2.1 and 2.2 more than two '
  'readings of one number: an expansion added to EITHER alone reds here.');

select ok(
  (select count(*) from s423_cells where praw = f and f > 0) > 0,
  format('2.4 NON-VACUITY: %s cells reach the bound (raw = F > 0), so "raw ≤ F" is a constraint that '
         'is actually touched and not a statement about an all-zero population.',
         (select count(*) from s423_cells where praw = f and f > 0)));

-- 2.5 — RED-FIRST. Give scope_reaches a one-to-many commission -> organization arm.
savepoint s423_plant2;
do $p2$
declare v_pid uuid;
begin
  select pid into v_pid from s423_cells where kind = 'organization' and rraw = f and f > 0 order by f desc, pid limit 1;
  execute pg_temp.surgery('authz.scope_reaches(text,uuid,text,uuid)'::regprocedure,
    'p_requested_id = (select c.organization_id', 'true or p_requested_id = (select c.organization_id');
  perform setval('s423_p2_mut',
    (select count(*) from authz.assignment_facts(v_pid) af join s423_scopes s on s.kind = 'organization'
      where authz.scope_reaches(af.scope_kind, af.scope_id, 'organization', s.id)) + 1);
end $p2$;
rollback to savepoint s423_plant2;

select ok(
  (select last_value from s423_p2_mut) - 1
    > (select f from s423_cells where kind = 'organization' and rraw = f and f > 0 order by f desc, pid limit 1)
  and (select last_value from s423_p2_mut) > 1,
  format('2.5 ⭐⭐ 2.2 RED-FIRST UNDER ADR 0208 D3 TRIGGER 3 — "scope_reaches gains one-to-many or '
         'descendant expansion", planted. One commission fact made to reach every organization '
         'takes raw to %s against F = %s, so 2.2 reds. ⭐ The record''s trigger table reads `prose '
         'only` for trigger 3; this cell is a GATE for the half of it that a seeded principal''s '
         'facts can see. ⛔ 0 = the plant never ran.',
         (select last_value - 1 from s423_p2_mut),
         (select f from s423_cells where kind = 'organization' and rraw = f and f > 0 order by f desc, pid limit 1)));

select is(
  (select md5(pg_get_functiondef('authz.scope_reaches(text,uuid,text,uuid)'::regprocedure))),
  (select sum from s423_def where sig = 'authz.scope_reaches(text,uuid,text,uuid)'::regprocedure),
  '2.6 RESTORE: authz.scope_reaches is byte-identical to the definition captured before the plant.');

-- ============================================================================
-- §3 — CLAUSE 3: DEDUPLICATION OCCURS BEFORE PERMISSION CONFIRMATION.
-- The overlap and no-overlap rows are DERIVED from the sweep, never named here — a hand-picked
-- persona is a claim that rots the day the seed changes.
-- ============================================================================

select ok(
  (select pd = rd and pd < praw from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1),
  format('3.1 ⭐ DEDUP, ON THE WIDEST OVERLAP ROW (%s / %s, derived not named): the producer emits '
         'D = %s DISTINCT candidates out of raw = %s mappings, and D matches the fact-derived '
         'distinct count exactly. ⛔ A producer that confirmed once per FACT would show pd = raw '
         'here; 3.4 plants that and measures the red.',
         (select email from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1),
         (select kind from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1),
         (select pd from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1),
         (select praw from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1)));

select ok(
  (select pd = rd and pd = praw from s423_cells where rraw = rd and rd > 0 order by rd desc, pid, kind limit 1),
  format('3.2 ⭐ THE DISCRIMINATION HALF — a principal whose facts do NOT overlap (%s / %s) gives '
         'D = raw = %s. ⛔ Without this, 3.1''s `D < raw` could be read as "the producer always '
         'shrinks", which is a different claim; the pair shows it shrinks exactly when the facts '
         'collide and not otherwise.',
         (select email from s423_cells where rraw = rd and rd > 0 order by rd desc, pid, kind limit 1),
         (select kind from s423_cells where rraw = rd and rd > 0 order by rd desc, pid, kind limit 1),
         (select rd from s423_cells where rraw = rd and rd > 0 order by rd desc, pid, kind limit 1)));

select ok(
  (select count(*) from s423_cells where rraw > rd) > 0
  and (select count(*) from s423_cells where rraw = rd and rd > 0) > 0,
  format('3.3 NON-VACUITY: the swept slice carries BOTH polarities — %s overlap cells and %s '
         'no-overlap cells with a non-empty candidate set. ⛔ 3.1 and 3.2 each select one row; if '
         'the slice held only one polarity the other cell would be testing a NULL, and `ok(NULL)` '
         'is a fail, but this cell names WHY.',
         (select count(*) from s423_cells where rraw > rd),
         (select count(*) from s423_cells where rraw = rd and rd > 0)));

-- 3.4 — RED-FIRST. Remove the deduplication from the live producer.
savepoint s423_plant3;
do $p3$
declare r record;
begin
  select pid, kind into r from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1;
  execute pg_temp.surgery('authz.authorized_scope_ids(uuid,text,text)'::regprocedure,
    'select distinct case', 'select case');
  perform setval('s423_p3_mut',
    pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure, r.pid, r.kind, true) + 1);
end $p3$;
rollback to savepoint s423_plant3;

select ok(
  (select last_value from s423_p3_mut) > 1
  and (select last_value from s423_p3_mut) - 1
      = (select praw from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1)
  and (select last_value from s423_p3_mut) - 1
      <> (select rd from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1),
  format('3.4 ⭐⭐ 3.1 RED-FIRST WITH THE DEDUPLICATION REMOVED from the live body: the producer '
         'emits %s candidates where the distinct set is %s, so `pd = rd` reds and `pd < praw` reds. '
         '⛔ 0 = the plant never ran.',
         (select last_value - 1 from s423_p3_mut),
         (select rd from s423_cells where rraw > rd order by (rraw - rd) desc, pid, kind limit 1)));

select is(
  (select md5(pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure))),
  (select sum from s423_def where sig = 'authz.authorized_scope_ids(uuid,text,text)'::regprocedure),
  '3.5 RESTORE: the producer is byte-identical to the captured definition.');

-- ============================================================================
-- §4 — CLAUSE 4: `D ≤ F`, the half a transaction can measure. ⛔ `U` is NOT here — see the header.
-- ============================================================================

select is(
  (select count(*)::int from s423_cells where pd <> rd),
  0,
  '4.1 ⭐⭐ THE CROSS-CHECK: the producer''s own distinct candidate count equals the fact-derived '
  'one, in every swept cell. ⛔ This is the cell that makes the rest more than bookkeeping — the '
  'producer''s inline CASE and authz.scope_reaches must agree, and 4.4 breaks it downward while '
  '1.4 breaks it upward. ⛔ A ONE-DIRECTIONAL mutation would leave the opposite polarity unproven.');

select is(
  (select count(*)::int from s423_cells where pd > f),
  0,
  '4.2 ⭐ `D ≤ F`, ADR 0208 D1''s invariant, over every swept cell. ⛔ No maximum is pinned and none '
  'may be: D1 is a PARAMETRIC structural invariant plus accepted operational risk, and a numeric '
  'ceiling here would assert the fixture instead of the shape.');

select ok(
  (select count(*) from s423_cells where f >= 2 and pd >= 1) > 0,
  format('4.3 NON-VACUITY: %s cells have F ≥ 2 with at least one candidate, so `D ≤ F` has room to '
         'be violated and is not read off an all-zero or all-singleton population.',
         (select count(*) from s423_cells where f >= 2 and pd >= 1)));

-- 4.4 — RED-FIRST, the OPPOSITE polarity to 1.4: a producer that LOSES a fact-derived candidate.
savepoint s423_plant4;
do $p4$
declare v_n int;
begin
  execute pg_temp.surgery('authz.authorized_scope_ids(uuid,text,text)'::regprocedure,
    'from authz.assignment_facts(p_principal) af',
    'from authz.assignment_facts(p_principal) af where af.scope_kind <> ''hospital''');
  select count(*) into v_n from s423_cells c
   where pg_temp.pcount('authz.authorized_scope_ids(uuid,text,text)'::regprocedure, c.pid, c.kind, true) <> c.rd;
  perform setval('s423_p4_mut', v_n + 1);
end $p4$;
rollback to savepoint s423_plant4;

select ok(
  (select last_value from s423_p4_mut) > 1,
  format('4.4 ⭐⭐ 4.1 RED-FIRST IN THE OTHER DIRECTION — a producer whose provider rows are filtered '
         'so hospital-rooted facts propose nothing: %s. ⛔ 1.4 proved the cell can see an EXTRA '
         'candidate; this proves it can see a MISSING one, which is the polarity a containment-only '
         'assertion never tests.',
         (select case when last_value = 0 then 'THE PLANT NEVER RAN — the surgery raised and the '
                        'savepoint recovered it, which is a VOID reading and never a pass'
                      else format('%s cells then disagree with the fact-derived count (baseline 0)',
                                  last_value - 1) end
            from s423_p4_mut)));

select is(
  (select md5(pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure))),
  (select sum from s423_def where sig = 'authz.authorized_scope_ids(uuid,text,text)'::regprocedure),
  '4.5 RESTORE: the producer is byte-identical to the captured definition.');

-- ============================================================================
-- §5 — CLAUSE 5: ONE PRODUCER, TWO CONFIRMERS, ASSERTED ON THE LIVE BODIES.
-- True today by DUPLICATION, not by construction — there is no shared producer function, there are
-- two copies. ADR 0208 D2 says so, and this is the cell that notices the day they part.
-- ============================================================================

select is(
  pg_temp.cte_norm('authz.authorized_scope_ids(uuid,text,text)'::regprocedure),
  pg_temp.cte_norm('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure),
  '5.1 ⭐⭐ THE CANDIDATE CTEs ARE THE SAME PRODUCER, compared on the LIVE bodies after stripping '
  '`--` comments and collapsing whitespace. ⛔ A raw-text equality is forbidden and 5.3 is why.');

select ok(
  pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure) like '%authz.has_permission(%'
  and pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure) not like '%authz.candidate_has_permission(%'
  and pg_get_functiondef('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure) like '%authz.candidate_has_permission(%'
  and pg_get_functiondef('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure) not like '% authz.has_permission(%',
  '5.2 ⭐ AND THEY DIFFER ONLY IN THEIR CONFIRMER: the runtime body names authz.has_permission and '
  'not the candidate one, the candidate body the converse. ⛔ Without this, 5.1 would be satisfied '
  'by two functions that are the same function twice — "one producer, two confirmers" needs the '
  'TWO as much as the ONE.');

-- 5.3 — the cut must be INSENSITIVE to the confirmer, and this is also 5.2's red witness.
savepoint s423_plant5b;
do $p5b$
begin
  execute pg_temp.surgery('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure,
    'authz.candidate_has_permission(p_principal', 'authz.has_permission(p_principal');
  perform setval('s423_p5_cte',
    case when pg_temp.cte_norm('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure)
            = (select cten from s423_def where sig = 'authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure)
         then 1 else 0 end + 1);
  perform setval('s423_p5_conf',
    case when pg_get_functiondef('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure) like '%authz.candidate_has_permission(%'
         then 1 else 0 end + 1);
end $p5b$;
rollback to savepoint s423_plant5b;

select ok(
  (select last_value from s423_p5_cte) = 2 and (select last_value from s423_p5_conf) = 1,
  '5.3 ⭐⭐ THE CUT IS INSENSITIVE TO THE CONFIRMER, and this is 5.2''s red witness in one block. '
  'With the candidate resolver''s confirmer swapped to authz.has_permission, the extracted CTE''s '
  'normalised md5 is UNCHANGED (so 5.1 can neither be satisfied nor broken by confirmer text — the '
  'boundary really is the producer) while 5.2''s predicate goes FALSE. ⛔ A boundary that crept into '
  'the confirm select would make 5.1 red for a reason that has nothing to do with the candidate '
  'logic, and one that stopped short would make it green for the same kind of reason. ⛔ Either '
  'probe at 0 means the block never ran. ⛔ A raw-text equality is NOT used as the comparator '
  'anywhere: measured, a raw diff of the two definitions exits 1 on the signature, THREE `--` '
  'comment lines and the confirmer, so it would be permanently red and prove nothing.');

-- 5.4 — RED-FIRST. One token changed inside ONE candidate CTE, semantics untouched.
savepoint s423_plant5;
do $p5$
begin
  execute pg_temp.surgery('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure,
    'when af.scope_kind = p_resolution_kind then af.scope_id',
    'when af.scope_kind = p_resolution_kind then af.scope_id::uuid');
  perform setval('s423_p5_mut',
    case when pg_temp.cte_norm('authz.authorized_scope_ids(uuid,text,text)'::regprocedure)
            = pg_temp.cte_norm('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure)
         then 1 else 0 end + 1);
end $p5$;
rollback to savepoint s423_plant5;

select is(
  (select last_value::int from s423_p5_mut),
  1,
  '5.4 ⭐⭐ 5.1 RED-FIRST UNDER A ONE-TOKEN CHANGE to one candidate CTE (`af.scope_id` → '
  '`af.scope_id::uuid`, a NO-OP semantically) — the comparator parts them (recorded as 0+1). '
  '⛔ The token is deliberately meaning-preserving: D2 asks for ONE PRODUCER, so an equivalent '
  're-spelling is a true signal, not a false alarm. ⛔ 0 = the plant never ran; 2 = the comparator '
  'is blind to a changed body, which is worse than a fail.');

select is(
  (select md5(pg_get_functiondef('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure))),
  (select sum from s423_def where sig = 'authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure),
  '5.5 RESTORE: the candidate resolver is byte-identical to the captured definition.');

-- ============================================================================
-- §6 — CLAUSE 6: A NEW PROVIDER ADAPTER FAILS THE ASSERTION UNTIL IT IS INCLUDED.
-- ⭐ This is the ONE ADR 0208 D3 trigger that fires automatically (triggers 1 and 2).
-- The family is DERIVED FROM A PROPERTY, never hand-listed: both sides of every comparison are
-- read live from the catalog in the same statement.
-- ============================================================================

create temp view s423_providers as
  select p.oid, n.nspname || '.' || p.proname as qname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz'
     and p.prokind = 'f'
     and pg_get_function_identity_arguments(p.oid)
         = pg_get_function_identity_arguments('authz.assignment_facts(uuid)'::regprocedure)
     and pg_get_function_result(p.oid)
         = pg_get_function_result('authz.assignment_facts(uuid)'::regprocedure);

create temp view s423_unconsumed as
  select pf.qname from s423_providers pf
   where (select count(*) from (values ('authz.authorized_scope_ids(uuid,text,text)'::regprocedure),
                                       ('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure)) f(sig)
           where pg_temp.cte(f.sig) like '%' || pf.qname || '(%') < 2;

select ok(
  (select count(*) from s423_providers) > 0
  and exists (select 1 from s423_providers where qname = 'authz.assignment_facts'),
  format('6.1 ⭐⭐ THE FAMILY IS NON-EMPTY AND CONTAINS THE KNOWN PROVIDER — %s member(s): %s. ⛔ THIS '
         'IS 6.2''s VACUITY CONTROL: "every provider is consumed" is TRUE FOR FREE over an empty '
         'family, so a property that quietly stopped matching anything would read as a clean pass. '
         'The property is `pg_get_function_identity_arguments` = %L and `pg_get_function_result` = '
         '%L, both read live from the catalog, never typed here.',
         (select count(*) from s423_providers),
         (select string_agg(qname, ', ' order by qname) from s423_providers),
         pg_get_function_identity_arguments('authz.assignment_facts(uuid)'::regprocedure),
         pg_get_function_result('authz.assignment_facts(uuid)'::regprocedure)));

select is(
  (select count(*)::int from s423_unconsumed),
  0,
  '6.2 ⭐ EVERY DERIVED PROVIDER IS CONSUMED BY BOTH CANDIDATE CTEs. ⛔ BOTH, not either: a provider '
  'wired into the runtime resolver but not the candidate twin would silently make the pre-cutover '
  'oracle answer about a different fact set. This is ADR 0208 D3 triggers 1 and 2 — `administrativo` '
  'as a permission provider, or any other adapter — firing BY CONSTRUCTION at ADR 0207 proposed-'
  'order item 6.');

-- 6.3 — RED-FIRST. A provider adapter planted in the family, consumed by nothing.
savepoint s423_plant6;
do $p6$
begin
  create function authz.ae4_probe_facts(p_principal uuid)
    returns table(role_code text, scope_kind text, scope_id uuid)
    language sql stable security definer set search_path to ''
    as $stub$ select null::text, null::text, null::uuid where false $stub$;
  perform setval('s423_p6_size', (select count(*) from s423_providers) + 1);
  perform setval('s423_p6_unc',  (select count(*) from s423_unconsumed) + 1);
end $p6$;
rollback to savepoint s423_plant6;

select ok(
  (select last_value from s423_p6_size) - 1 > (select count(*) from s423_providers)
  and (select last_value from s423_p6_unc) - 1 = 1,
  format('6.3 ⭐⭐ 6.1 AND 6.2 RED-FIRST AGAINST A PLANTED ADAPTER — a stub in the provider family '
         'that neither CTE consumes takes the family to %s and the unconsumed count to %s, so 6.2 '
         'reds. ⛔ The stub matches the PROPERTY, not a name: it is caught because of its argument '
         'list and row type. ⛔ Stated bound — a provider in another schema, with a different arity, '
         'with a renamed or extra column, spelled `setof <composite>`, reached through a wrapper, or '
         'plumbed in as a VIEW is MISSED, and widening the property is a human''s job under D3. '
         '⛔ 0 = the plant never ran.',
         (select last_value - 1 from s423_p6_size), (select last_value - 1 from s423_p6_unc)));

select is(
  (select count(*)::int from s423_providers),
  1,
  '6.4 RESTORE: the planted adapter is gone and the family is the single known provider again. '
  '⛔ Written as the measured value 1 rather than "the value before the plant" on purpose: this is '
  'the one place the file states what the family IS, so adding a real second provider reds HERE '
  'too and a human reads D3 trigger 2 rather than editing 6.2 until it passes.');

select * from finish();
rollback;
