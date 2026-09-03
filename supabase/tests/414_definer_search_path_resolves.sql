-- 414 — every SECURITY DEFINER search_path in app/public/authz actually RESOLVES.
-- Closes the sweep half of `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`
-- (docs/progress/follow-ups-open.md), filed out of the QA review of the AE4/IA-F9
-- statement-scoped increment (ADR 0182 § Corrections; fixed instance `20261003007330`).
--
-- ⭐ THE DEFECT CLASS. `set search_path to 'app, public, pg_catalog'` — SINGLE-QUOTED — is
-- accepted by Postgres as ONE identifier naming a schema that does not exist, not as a
-- three-element list. A non-existent schema in `search_path` is SKIPPED, not an error. So a
-- SECURITY DEFINER function written that way declares a resolution order it does not have:
-- measured on the one known instance, `current_schemas(true)` inside
-- `app.current_professional_read_organizations` was `{pg_temp_N, pg_catalog}` against its
-- sibling's `{pg_temp_N, app, public, pg_catalog}`. Nothing in this repo noticed — not the
-- twelve lint gates (none read `proconfig`), not the four authz arms, not the door sweep, and
-- not pgTAP, whose one relevant assertion had hand-typed its expected value BY COPYING THE
-- BROKEN CATALOG and therefore pinned the defect as expected.
--
-- ⛔ THE CHECK IS BOUND ON THE PROPERTY, NOT ON THE SYMPTOM. The property is *every named
-- schema resolves in pg_namespace*; the symptom is *the stored value contains a quote*. They
-- are not the same predicate and the second is the wrong instrument in both directions —
-- measured 2026-09-03 on this catalog:
--
--   set search_path to 'app, public, pg_catalog'   =>  proconfig  {"search_path=\"app, public, pg_catalog\""}   BROKEN
--   set search_path to no_such_schema_414          =>  proconfig  {search_path=no_such_schema_414}              BROKEN, and carries NO quote
--   set search_path to app, public, pg_catalog     =>  proconfig  {"search_path=app, public, pg_catalog"}       fine
--   set search_path to ''                          =>  proconfig  {"search_path=\"\""}                          fine (the empty form)
--   set search_path to 'app'                       =>  proconfig  {search_path=app}                             fine — the quotes are NOT stored
--   set search_path to "$user", public             =>  proconfig  {"search_path=\"$user\", public"}             fine
--
-- Row 2 is the false negative a quote-matcher would miss; rows 4 and 6 are the false positives
-- it would raise. §2 plants all six shapes and pins which of them the sweep flags, so the
-- distinction is asserted rather than argued.
--
-- ⛔⛔ THIS GATE STARTS GREEN — the FUP measured the live population at 0 offenders and §1
-- re-measures it at 0. A detector that has only ever found nothing is indistinguishable from a
-- dead one, so §2 is NOT optional decoration: it plants a collapsed DEFINER inside a savepoint
-- and REQUIRES the sweep to fire on it. If §2 goes green-by-not-firing the suite fails, which
-- is the correct reading — VOID, not PASS.
--
-- ⚠ NO `test_helpers.bootstrap()`, no fixture, no tenancy. This suite reads pg_proc and
-- pg_namespace only, so it is invariant to seed scale and to the AE4 perf fixture.
--
-- RUN SHAPE: `Files=2, Tests=8` (7 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing a
-- count mismatch.

begin;
select plan(7);

-- ============================================================================
-- §0 — THE SWEEP, DEFINED ONCE. Three views, so §1 (live population) and §2 (planted
-- controls) run THE SAME predicate rather than two hand-written copies of it. An
-- exact-match neutralizer written twice is a duplicate no gate protects.
--
--   v414_domain    — every prosecdef function in app/public/authz, with its raw search_path
--   v414_tokens    — that value split into the schema names it actually NAMES
--   v414_offenders — the tokens that name nothing
--
-- Tokenizing: the value is a GUC list, so a element containing a comma or a space is stored
-- DOUBLE-QUOTED. Splitting naively on ',' would shred exactly the broken form we are hunting
-- into three plausible-looking fragments, so the regex MATCHES tokens (a quoted run, or a run
-- of non-commas) instead of splitting on the separator.
-- ============================================================================
create temp view v414_domain as
  select p.oid,
         n.nspname as schema_name,
         p.proname,
         n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
         (select substring(c from 13) from unnest(p.proconfig) c
           where c like 'search\_path=%' limit 1) as sp
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public', 'authz')
     and p.prosecdef;

create temp view v414_tokens as
  select d.oid, d.schema_name, d.proname, d.sig, d.sp,
         case when btrim(m.a[1]) like '"%"'
              then replace(substring(btrim(m.a[1]) from 2 for length(btrim(m.a[1])) - 2), '""', '"')
              else btrim(m.a[1])
         end as name
    from v414_domain d
    cross join lateral regexp_matches(d.sp, '"(?:[^"]|"")*"|[^,]+', 'g') as m(a)
   where d.sp is not null;

-- Exempt, and each for a stated reason — none of them is a schema that must exist:
--   ''        the empty form, the tightest possible search_path (23 of the 890 in THIS domain
--             use it: 7 in app, 10 in authz, 6 in public — measured 2026-09-03. The often-quoted
--             "7" is the app-only figure and is wrong for the domain this view sweeps.)
--   $user     a placeholder resolved per session, absent by design for most roles
--   pg_temp   the session-temp alias; the real namespace is pg_temp_<N>, created on demand
create temp view v414_offenders as
  select t.sig, t.schema_name, t.proname, t.sp, t.name
    from v414_tokens t
   where t.name <> ''
     and t.name <> '$user'
     and t.name <> 'pg_temp'
     and t.name not like 'pg\_temp\_%'
     and not exists (select 1 from pg_namespace ns where ns.nspname = t.name);

-- 1. DOMAIN, as a named set. A sweep that quietly stopped covering a schema — a rename, a typo
--    in the list above, a schema that moved — reports the same clean 0 as a sweep that covered
--    everything. Naming the schemas makes that failure visible instead of silent.
select is(
  (select string_agg(distinct schema_name, ' | ' order by schema_name) from v414_domain),
  'app | authz | public',
  '§0a DOMAIN as a NAMED SET: the sweep examines prosecdef functions in all three of app, authz and public. ⛔ If this reds, the sweep stopped covering a schema — a clean §1 below then means nothing for that schema'
);

-- 2. THE SWEEP'S OWN BLIND SPOT, pinned. A DEFINER with NO `set search_path` at all has no
--    value to tokenize, so it drops out of v414_tokens silently and §1 can never see it — and
--    an unpinned DEFINER is a strictly worse instance of this same resolution-hijack class.
--    Measured 2026-09-03: 890 of 890 carry one. Naming any that stop doing so is free here.
select is(
  (select coalesce(string_agg(sig, '; ' order by sig), '') from v414_domain where sp is null),
  '',
  '§0b NO SILENT EXITS FROM THE DOMAIN: every prosecdef function in app/public/authz declares a search_path at all. ⛔ A function listed here is NOT covered by §1 — it has no declared resolution order to check, which is the same hijack shape one step earlier'
);

-- ============================================================================
-- §1 — THE LIVE POPULATION. The property, over the whole class, with the offender NAMED so a
-- red is actionable rather than a bare count.
-- ============================================================================
select is(
  (select coalesce(string_agg(sig || ' -> names ' || quote_literal(name) || ' (search_path=' || sp || ')',
                              '; ' order by sig, name), '')
     from v414_offenders),
  '',
  '§1 THE PROPERTY: every schema named in every prosecdef search_path in app/public/authz resolves in pg_namespace. ⛔ A function listed here declares a resolution order it does not have — Postgres SKIPS the absent schema silently, so it will run with a SHORTER effective search_path than its source reads'
);

-- ============================================================================
-- §2 — THE CONTROLS. §1 has never returned a row and (per the FUP's own sweep) never has, so
-- it is at this point indistinguishable from a broken query. Plant all six shapes from the
-- header table and pin exactly which ones the sweep flags. Rolled back by the savepoint.
--
-- ⭐ The POSITIVE half proves the sweep can find something; the NEGATIVE half proves it is
-- bound on schema-existence and not on quoting. Both are needed: a detector that flags
-- everything would satisfy the positive half alone, and §1 would already be red.
-- ============================================================================
savepoint s414_plant;

create function public.z414_ctl_collapsed_list() returns text language sql stable
  security definer set search_path to 'app, public, pg_catalog' as $ctl$ select 'x' $ctl$;
create function public.z414_ctl_absent_schema() returns text language sql stable
  security definer set search_path to no_such_schema_414 as $ctl$ select 'x' $ctl$;
create function public.z414_ctl_wellformed_list() returns text language sql stable
  security definer set search_path to app, public, pg_catalog as $ctl$ select 'x' $ctl$;
create function public.z414_ctl_empty_form() returns text language sql stable
  security definer set search_path to '' as $ctl$ select 'x' $ctl$;
create function public.z414_ctl_quoted_existing() returns text language sql stable
  security definer set search_path to 'app' as $ctl$ select 'x' $ctl$;
create function public.z414_ctl_user_placeholder() returns text language sql stable
  security definer set search_path to "$user", public as $ctl$ select 'x' $ctl$;

-- 3. THE POSITIVE CONTROL, and the anti-symptom half, as ONE named set. Anything other than
--    these two names — more, fewer, different — is a finding about the instrument.
select is(
  (select coalesce(string_agg(distinct proname, ' | ' order by proname), '(NOTHING FIRED)')
     from v414_offenders where proname like 'z414\_ctl\_%'),
  'z414_ctl_absent_schema | z414_ctl_collapsed_list',
  '§2a THE SWEEP CAN BITE, on exactly the two broken shapes: the single-quoted list (one identifier naming nothing) and a bare name for a schema that does not exist — and NOT on the quoted-but-existing, empty, well-formed or $user forms. ⛔ `(NOTHING FIRED)` means §1 above proved nothing: read it as VOID, not as a pass'
);

-- 4. ...and the four that did NOT fire were EXAMINED, not excluded. A probe absent from
--    v414_tokens is unflagged for the same reason a deleted function is: it was never looked
--    at. Without this, the negative half of §2a is satisfied by a domain that dropped them.
select is(
  (select string_agg(distinct proname, ' | ' order by proname)
     from v414_tokens where proname like 'z414\_ctl\_%'),
  'z414_ctl_absent_schema | z414_ctl_collapsed_list | z414_ctl_empty_form | z414_ctl_quoted_existing | z414_ctl_user_placeholder | z414_ctl_wellformed_list',
  '§2b ALL SIX PROBES WERE TOKENIZED: the four that §2a leaves unflagged are in the sweep''s domain and were checked, so their pass is an EXAMINATION and not an exclusion'
);

-- 5. THE MECHANISM ITSELF, not just the verdict. This is the whole defect in one line: the
--    same six characters of source text produce three resolvable schemas or one that names
--    nothing, depending only on a pair of quotes.
select is(
  (select (select string_agg(name, '+' order by name) from v414_tokens where proname = 'z414_ctl_wellformed_list')
       || '  vs  ' ||
          (select string_agg(name, '+' order by name) from v414_tokens where proname = 'z414_ctl_collapsed_list')),
  'app+pg_catalog+public  vs  app, public, pg_catalog',
  '§2c THE MECHANISM: unquoted, the value splits into THREE schema names that each resolve; single-quoted, it is ONE token whose text is the entire list — a schema name containing commas and spaces, which Postgres then skips in silence'
);

rollback to savepoint s414_plant;

-- ============================================================================
-- §3 — RESTORE. The controls are gone and the live verdict is back where §1 found it.
-- ============================================================================
select ok(
  (select count(*) from v414_domain where proname like 'z414\_ctl\_%') = 0
  and (select count(*) from v414_offenders) = 0,
  '§3 RESTORE: every planted control is gone and the live population is back to 0 offenders — §2 mutated nothing that outlives it'
);

select * from finish();
rollback;
