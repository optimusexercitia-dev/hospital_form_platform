-- 420 — the FOUR temp-table SECURITY DEFINERs, measured under `search_path = ''`.
--
-- Owed by ADR 0208 D6: *"The four DEFINER functions intentionally using temporary tables should
-- receive targeted testing before any catalog-wide ALTER FUNCTION hardening sweep."* They are
-- named there, and measured as exactly four:
--
--   app.copy_response_answers(uuid,uuid)           temp `_copy_answer_map`
--   app.copy_template_version_children(uuid,uuid)  temp `_tpl_phase_map`
--   app.copy_version_children(uuid,uuid)           temp `_clone_section_map` + `_clone_item_map`
--   public.clone_framework(uuid,uuid)              temp `_clone_standard_map`
--
-- ⭐ WHAT THIS FILE IS FOR: turning *"an empty path is not a free change for these four"* from an
-- assumption into a PER-FUNCTION VERDICT. Each § proves the function works TODAY, then — inside a
-- rolled-back savepoint — ALTERs that ONE function to the empty path and runs it again. ⛔ No
-- catalog-wide sweep, and every ALTER is undone before the next § begins.
--
-- ⭐ THE MEASURED VERDICT, 2026-09-11: ALL FOUR ARE A FREE CHANGE. The prediction going in was the
-- opposite — that each body creates a temp table and then references it UNQUALIFIED (`insert into
-- _tpl_phase_map`, `join _copy_answer_map m`), which an empty `search_path` would fail to resolve.
-- ⛔ THAT PREDICTION IS WRONG, AND THE REASON MATTERS MORE THAN THE VERDICT: Postgres searches
-- `pg_temp` IMPLICITLY AND FIRST for relation names whenever it is not listed explicitly, so
-- `search_path = ''` does not remove the temp schema from relation resolution — it removes `app`
-- and `public`. That is the SAME mechanism ADR 0208 D5 quotes as the reason the empty form is
-- preferred: a temp object can precede the declared schemas and shadow an unqualified relation.
-- Here it is what makes these four survive; in a body that names a PERSISTENT relation unqualified
-- it is the hijack. ⛔ So "free" here is a statement about these four bodies, never a general one.
--
-- ⚠ WHY THE EFFECT IS ASSERTED AND NOT JUST "IT DID NOT THROW". A function that returns without
-- copying anything also does not throw. Every § below compares the DESTINATION's row counts
-- against the SOURCE's, and § 0 separately proves each source is non-empty — so "copied 0 of 0"
-- cannot be mistaken for "copied everything". Three harness defects were found and fixed by
-- insisting on that, and each would have produced a confident false verdict:
--   1. the TODAY call contaminated the UNDER-'' call (the second hit a unique violation the first
--      had created) — every probe now sits in its OWN savepoint;
--   2. `public.clone_framework` denied with 42501 BEFORE reaching its temp table, because it has
--      no null-actor tolerance — an earlier guard firing leaves the later code untested, so the
--      CALLER was fixed (a seated `staff_admin` hat via `test_helpers.claims_for`), never the
--      expectation;
--   3. the cloned framework collided with its own source on `(key, owner_commission_id)` — the
--      source is now a GLOBAL framework (`owner_commission_id is null`), which is also the only
--      shape `clone_framework`'s own cross-commission guard admits.
--
-- ⚠ EVERY ALTER IS PROVEN TO HAVE APPLIED, in the same assertion that reads its effect: each
-- UNDER-'' expectation carries the function's live `proconfig`. A mutation that did not apply
-- reports green, and this is the cheapest place to notice.
--
-- ⚠ FIXTURES ARE DERIVED BY PROPERTY, NEVER BY HARD-CODED ID — "a published version that HAS
-- items", "a submitted response whose answers HAVE selected options". A seed change then reds
-- § 0 with a diagnosis instead of silently making a later § copy nothing.
--
-- ⭐ AND THE VERDICT "FREE" IS ITSELF CONTROLLED. Four functions all answering "OK" is exactly
-- what an instrument that cannot see a failure also answers, so § 6 plants a DEFINER that
-- references a PERSISTENT relation unqualified, ALTERs it the same way, and REQUIRES it to fail
-- with 42P01. ⛔ If § 6 goes green-by-not-failing, read §§ 1b/2b/3b/4b as VOID, not as passes.
--
-- ⚠ `# Looks like you planned N tests but ran M` is EXPECTED here and is not a failure: this file
-- carries SIX savepoints with assertions inside them, and pgTAP's internal counter unwinds on each
-- `rollback to savepoint` while the TAP stream pg_prove actually parses is already emitted.
-- ⛔ DO NOT GENERALISE THAT DISMISSAL. pg_prove's own **"Bad plan"** — the plan line against the
-- number of `ok` lines actually emitted — IS a failure, and it is the detector for the defect
-- `419` hit while being written: an assertion inside a savepoint that RAISED, with the following
-- `rollback to savepoint` recovering the error, so the test silently never ran at all. A mismatch
-- in pgTAP's diagnostic is noise; a mismatch in the PLAN is the finding.
--
-- RUN SHAPE: `Files=2, Tests=16` (15 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan().

begin;
select plan(15);

-- Flags are forced ON in-transaction: `clone_framework` raises HC0Q9 and the process-template
-- doors raise their own gate while their flag is off, which would deny before the temp-table code
-- — the same "an earlier guard fired" trap as the 42501 above. Rolled back with everything else.
update app.feature_flags set enabled = true;

create temp table fx420 on commit drop as
select (select fv.id from public.form_versions fv
         where exists (select 1 from public.form_items i where i.form_version_id = fv.id)
           and exists (select 1 from public.form_sections s where s.form_version_id = fv.id)
         order by fv.id limit 1) as fv,
       (select tv.id from public.process_template_versions tv
         where exists (select 1 from public.process_template_phases p where p.template_version_id = tv.id)
         order by tv.id limit 1) as ptv,
       (select r.id from public.responses r
         where r.status = 'submitted'
           and exists (select 1 from public.answer_selected_options so
                        join public.answers a on a.id = so.answer_id where a.response_id = r.id)
         order by r.id limit 1) as src_resp,
       (select m.principal_id from public.memberships m
         where m.role = 'staff_admin' and m.commission_id is not null
         order by m.principal_id limit 1) as sa,
       (select m.commission_id from public.memberships m
         where m.role = 'staff_admin' and m.commission_id is not null
         order by m.principal_id limit 1) as comm;

-- The destination response: a DIFFERENT creator from the source's, because
-- `responses_one_draft_per_user_idx` allows one in_progress draft per (version, user).
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select 'e4200000-0000-0000-0000-000000000001', r.form_version_id, r.commission_id,
       (select p.id from public.profiles p where p.id <> r.created_by
         and not exists (select 1 from public.responses r2
                          where r2.form_version_id = r.form_version_id and r2.created_by = p.id
                            and r2.status = 'in_progress')
         order by p.id limit 1),
       'in_progress'
  from public.responses r where r.id = (select src_resp from fx420);

-- A GLOBAL source framework (owner null): `clone_framework` refuses a source owned by another
-- commission, and cloning an owned framework into its own owner collides on (key, owner).
insert into public.accreditation_frameworks (id, key, name, version, owner_commission_id, status)
values ('f4200000-0000-0000-0000-000000000001', '420-src', 'Fixture 420', '1', null, 'ativo');
insert into public.accreditation_standards (id, framework_id, code, title, parent_id)
values ('f4200000-0000-0000-0000-0000000000a1', 'f4200000-0000-0000-0000-000000000001', 'P1', 'parent', null),
       ('f4200000-0000-0000-0000-0000000000a2', 'f4200000-0000-0000-0000-000000000001', 'P1.1', 'child',
        'f4200000-0000-0000-0000-0000000000a1');

-- ⚠ KEYED ON THE FULL SIGNATURE VIA `regprocedure`, NOT ON A BARE `proname` (QA MINOR-4). The
-- earlier form matched `nspname + proname` with no argument types; a SQL function returning a
-- scalar over a multi-row query silently yields the FIRST row, so the moment any of these four
-- gains an overload the `[cfg …]` witness — the very thing proving each ALTER applied — could read
-- a DIFFERENT function's proconfig and still report green. `::regprocedure` resolves one oid or
-- RAISES, so the guard no longer rests on a catalog fact nothing asserts. (§ 5c asserts it anyway.)
create or replace function pg_temp.cfg420(p_sig text) returns text language sql stable as $$
  select coalesce(array_to_string(p.proconfig, ','), '<none>')
    from pg_proc p where p.oid = p_sig::regprocedure $$;

-- Each runner returns `OK | <effect>` or `<sqlstate> :: <message>`, so an UNEXPECTED FAILURE is
-- reported as the error text rather than collapsing into a bare false.
create or replace function pg_temp.run420_a() returns text language plpgsql as $$
declare v uuid;
begin
  begin v := public.clone_form_version((select fv from fx420));
  exception when others then return sqlstate || ' :: ' || sqlerrm; end;
  return 'OK | items=' || (select count(*) from public.form_items where form_version_id = v)
       || ' sections=' || (select count(*) from public.form_sections where form_version_id = v);
end $$;

create or replace function pg_temp.run420_b() returns text language plpgsql as $$
declare v uuid;
begin
  begin v := public.clone_template_version((select ptv from fx420));
  exception when others then return sqlstate || ' :: ' || sqlerrm; end;
  return 'OK | phases=' || (select count(*) from public.process_template_phases where template_version_id = v);
end $$;

create or replace function pg_temp.run420_c() returns text language plpgsql as $$
begin
  begin perform app.copy_response_answers((select src_resp from fx420), 'e4200000-0000-0000-0000-000000000001');
  exception when others then return sqlstate || ' :: ' || sqlerrm; end;
  -- ⭐ `selopts` is the load-bearing half: it is copied by `join _copy_answer_map m`, the
  -- UNQUALIFIED temp-table reference this whole file is about. `answers` alone would be copied
  -- by step 2, which never touches the map.
  return 'OK | answers=' || (select count(*) from public.answers where response_id = 'e4200000-0000-0000-0000-000000000001')
       || ' selopts=' || (select count(*) from public.answer_selected_options so
                           join public.answers a on a.id = so.answer_id
                          where a.response_id = 'e4200000-0000-0000-0000-000000000001');
end $$;

create or replace function pg_temp.run420_d() returns text language plpgsql as $$
declare v public.accreditation_frameworks;
begin
  perform test_helpers.claims_for((select sa from fx420), false, 'staff_admin');
  begin v := public.clone_framework('f4200000-0000-0000-0000-000000000001', (select comm from fx420));
  exception when others then
    perform set_config('request.jwt.claims', '', true);
    return sqlstate || ' :: ' || sqlerrm;
  end;
  perform set_config('request.jwt.claims', '', true);
  -- ⭐ `rewired` is the load-bearing half: re-pointing the child's parent_id onto the CLONE's
  -- parent is the only thing `_clone_standard_map` exists to do.
  return 'OK | standards=' || (select count(*) from public.accreditation_standards where framework_id = v.id)
       || ' rewired=' || (select count(*) from public.accreditation_standards c
                            join public.accreditation_standards p on p.id = c.parent_id
                           where c.framework_id = v.id and p.framework_id = v.id);
end $$;

-- ============================================================================
-- § 0 — THE FIXTURES REACH A NON-TRIVIAL STATE. Without this every § below is satisfied by
-- "copied 0 of 0", which is exactly what a broken function also returns.
-- ============================================================================
select is(
  (select 'items:' || (select count(*) from public.form_items where form_version_id = (select fv from fx420))
       || ' sections:' || (select count(*) from public.form_sections where form_version_id = (select fv from fx420))
       || ' phases:' || (select count(*) from public.process_template_phases where template_version_id = (select ptv from fx420))
       || ' selopts:' || (select count(*) from public.answer_selected_options so
                            join public.answers a on a.id = so.answer_id where a.response_id = (select src_resp from fx420))
       || ' standards:' || (select count(*) from public.accreditation_standards where framework_id = 'f4200000-0000-0000-0000-000000000001')
       || ' actor:' || (case when (select sa from fx420) is null then 'MISSING' else 'seated' end)),
  (select 'items:' || greatest((select count(*) from public.form_items where form_version_id = (select fv from fx420)), 1)
       || ' sections:' || greatest((select count(*) from public.form_sections where form_version_id = (select fv from fx420)), 1)
       || ' phases:' || greatest((select count(*) from public.process_template_phases where template_version_id = (select ptv from fx420)), 1)
       || ' selopts:' || greatest((select count(*) from public.answer_selected_options so
                            join public.answers a on a.id = so.answer_id where a.response_id = (select src_resp from fx420)), 1)
       || ' standards:2 actor:seated'),
  '§ 0 FIXTURE REACH: every source carries at least one row of the thing its function copies, and a staff_admin actor exists. ⛔ A zero here means the § that consumes it proves nothing — "copied 0 of 0" is what a broken function returns too'
);

-- ============================================================================
-- § 1 — app.copy_version_children, via public.clone_form_version
-- ============================================================================
savepoint s420_a1;
select is(
  pg_temp.run420_a(),
  'OK | items=' || (select count(*) from public.form_items where form_version_id = (select fv from fx420))
              || ' sections=' || (select count(*) from public.form_sections where form_version_id = (select fv from fx420)),
  '§ 1a TODAY: app.copy_version_children copies every section and item of the source onto the clone'
);
rollback to savepoint s420_a1;

savepoint s420_a2;
alter function app.copy_version_children(uuid, uuid) set search_path = '';
select is(
  pg_temp.run420_a() || '  [cfg ' || pg_temp.cfg420('app.copy_version_children(uuid,uuid)') || ']',
  'OK | items=' || (select count(*) from public.form_items where form_version_id = (select fv from fx420))
              || ' sections=' || (select count(*) from public.form_sections where form_version_id = (select fv from fx420))
              || '  [cfg search_path=""]',
  '§ 1b UNDER `search_path = ''''`: identical, and the cfg in the expectation proves the ALTER APPLIED. ⇒ VERDICT: a FREE change — its `_clone_section_map` / `_clone_item_map` references resolve through the implicitly-first pg_temp'
);
rollback to savepoint s420_a2;

-- ============================================================================
-- § 2 — app.copy_template_version_children, via public.clone_template_version
-- ⭐ This function had ZERO pgTAP and zero TS/E2E coverage before this file — it is the gap in
-- D6's "tested first" precondition, so § 2a is also its first direct test of any kind.
-- ============================================================================
savepoint s420_b1;
select is(
  pg_temp.run420_b(),
  'OK | phases=' || (select count(*) from public.process_template_phases where template_version_id = (select ptv from fx420)),
  '§ 2a TODAY: app.copy_template_version_children copies every phase of the source onto the clone'
);
rollback to savepoint s420_b1;

savepoint s420_b2;
alter function app.copy_template_version_children(uuid, uuid) set search_path = '';
select is(
  pg_temp.run420_b() || '  [cfg ' || pg_temp.cfg420('app.copy_template_version_children(uuid,uuid)') || ']',
  'OK | phases=' || (select count(*) from public.process_template_phases where template_version_id = (select ptv from fx420))
              || '  [cfg search_path=""]',
  '§ 2b UNDER `search_path = ''''`: identical, ALTER proven applied. ⇒ VERDICT: a FREE change. ⚠ It also CALLS app.copy_version_children, which is NOT altered here — one function per savepoint, or the two verdicts contaminate each other'
);
rollback to savepoint s420_b2;

-- ============================================================================
-- § 3 — app.copy_response_answers, called directly
-- ============================================================================
savepoint s420_c1;
select is(
  pg_temp.run420_c(),
  'OK | answers=' || (select count(*) from public.answers where response_id = (select src_resp from fx420))
              || ' selopts=' || (select count(*) from public.answer_selected_options so
                                   join public.answers a on a.id = so.answer_id where a.response_id = (select src_resp from fx420)),
  '§ 3a TODAY: app.copy_response_answers copies the answers AND the selected options that travel through _copy_answer_map'
);
rollback to savepoint s420_c1;

savepoint s420_c2;
alter function app.copy_response_answers(uuid, uuid) set search_path = '';
select is(
  pg_temp.run420_c() || '  [cfg ' || pg_temp.cfg420('app.copy_response_answers(uuid,uuid)') || ']',
  'OK | answers=' || (select count(*) from public.answers where response_id = (select src_resp from fx420))
              || ' selopts=' || (select count(*) from public.answer_selected_options so
                                   join public.answers a on a.id = so.answer_id where a.response_id = (select src_resp from fx420))
              || '  [cfg search_path=""]',
  '§ 3b UNDER `search_path = ''''`: identical, ALTER proven applied. ⇒ VERDICT: a FREE change — the four unqualified `join _copy_answer_map` arms still resolve'
);
rollback to savepoint s420_c2;

-- ============================================================================
-- § 4 — public.clone_framework, under a SEATED staff_admin hat
-- ============================================================================
savepoint s420_d1;
select is(
  pg_temp.run420_d(),
  'OK | standards=2 rewired=1',
  '§ 4a TODAY: public.clone_framework copies both standards and RE-POINTS the child at the clone''s own parent — the one thing _clone_standard_map exists to do. ⛔ A 42501 here means the actor was not seated and every verdict in this § is VOID'
);
rollback to savepoint s420_d1;

savepoint s420_d2;
alter function public.clone_framework(uuid, uuid) set search_path = '';
select is(
  pg_temp.run420_d() || '  [cfg ' || pg_temp.cfg420('public.clone_framework(uuid,uuid)') || ']',
  'OK | standards=2 rewired=1  [cfg search_path=""]',
  '§ 4b UNDER `search_path = ''''`: identical, ALTER proven applied. ⇒ VERDICT: a FREE change'
);
rollback to savepoint s420_d2;

-- ============================================================================
-- § 5 — RESTORE. Every ALTER above is undone; none of them outlives its savepoint. ⛔ If this
-- reds, some § leaked a converged function into the rest of the suite — and `419`'s frozen set,
-- which runs after this file, would then shrink for a reason nobody migrated.
-- ============================================================================
select is(
  (select string_agg(pg_temp.cfg420(sig), ' | ' order by sig)
     from (values ('app.copy_response_answers(uuid,uuid)'), ('app.copy_template_version_children(uuid,uuid)'),
                  ('app.copy_version_children(uuid,uuid)'), ('public.clone_framework(uuid,uuid)')) t(sig)),
  'search_path=app, public, pg_catalog | search_path=app, public, pg_catalog | ' ||
  'search_path=app, public, pg_catalog | search_path=app, public, pg_catalog',
  '§ 5 RESTORE: all four are back on their original three-schema path — every ALTER was confined to its savepoint'
);

-- ⭐ AND THE FOUR ARE STILL IN 419'S FROZEN SET. Without this, § 5 is satisfied by a value that
-- happens to match while the freeze and this file disagree about what these functions are.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (('app','copy_response_answers'), ('app','copy_template_version_children'),
                                     ('app','copy_version_children'), ('public','clone_framework'))
      and p.prosecdef
      and coalesce((select substring(c from 13) from unnest(p.proconfig) c
                     where c like 'search\_path=%' limit 1), '""') <> '""'),
  4,
  '§ 5b ...and all four are still SECURITY DEFINER on a NON-EMPTY path, so they remain members of 419''s frozen set. ⛔ The verdict "free" is a finding for a FUTURE convergence, not a convergence this unit performed'
);

-- ⭐ § 5c — THE WRAPPERS STILL ROUTE THEIR SUBJECTS (QA MINOR-3). §§ 1 and 2 reach their subjects
-- only THROUGH `public.clone_form_version` / `public.clone_template_version`. The `[cfg …]` witness
-- proves the ALTER applied; nothing proved the altered function was still ON THE CALL PATH. If a
-- future change inlined the copy into the wrapper, §§ 1b/2b would stay green while measuring
-- NOTHING — a silent VOID of exactly the kind this file guards against everywhere else. Verified
-- from the LIVE definition, never from migration text.
select is(
  (select string_agg(w || ' -> ' ||
            (case when pg_get_functiondef(w::regprocedure) like '%' || sub || '%'
                  then 'routes' else 'DOES NOT ROUTE' end), ' | ' order by w)
     from (values ('public.clone_form_version(uuid)', 'app.copy_version_children'),
                  ('public.clone_template_version(uuid)', 'app.copy_template_version_children')) t(w, sub)),
  'public.clone_form_version(uuid) -> routes | public.clone_template_version(uuid) -> routes',
  '§ 5c THE CALL PATH ITSELF: each wrapper''s LIVE body still names the subject §§ 1/2 ALTER. ⛔ A `DOES NOT ROUTE` here means those sections measured the wrapper and not the function they claim to be about'
);

-- ⭐ § 5d — EXACTLY ONE OVERLOAD PER NAME (QA MINOR-4's second half). `cfg420` is now signature-keyed
-- so an overload cannot silently redirect it, but §§ 5/5b still select the four BY NAME. This pins
-- the catalog fact both rely on instead of leaving it as an accident that happens to hold today.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (('app','copy_response_answers'), ('app','copy_template_version_children'),
                                     ('app','copy_version_children'), ('public','clone_framework'))),
  4,
  '§ 5d ONE OVERLOAD EACH: the four names resolve to exactly four functions. ⛔ A 5 here means a name-keyed assertion above is reading an arbitrary one of two'
);

-- ============================================================================
-- § 6 — THE INSTRUMENT'S OWN CONTROL. Every verdict above is "OK", and an instrument that
-- answers OK unconditionally produces exactly that. Plant a DEFINER whose body names a
-- PERSISTENT relation unqualified — the shape `search_path = ''` genuinely breaks, and the shape
-- the four subjects deliberately do NOT have — and require the same ALTER to break it.
--
-- ⭐ The POSITIVE half (it works on the three-schema path) and the DISCRIMINATION half (it fails
-- on the empty one) are one named string: a control that had simply stopped working would
-- satisfy the second half alone, and would prove nothing about the instrument.
-- ============================================================================
savepoint s420_ctl;

create function public.z420_ctl_unqualified() returns bigint language sql stable
  security definer set search_path to app, public, pg_catalog
  as $ctl$ select count(*) from profiles $ctl$;

create or replace function pg_temp.run420_ctl() returns text language plpgsql as $$
declare v bigint;
begin
  begin v := public.z420_ctl_unqualified();
  exception when others then return sqlstate; end;
  return case when v >= 0 then 'OK' else 'NEGATIVE?' end;
end $$;

select is(
  (select pg_temp.run420_ctl()),
  'OK',
  '§ 6a THE CONTROL WORKS ON THE THREE-SCHEMA PATH: an unqualified `from profiles` resolves there. ⛔ A red here means § 6b below would pass for the wrong reason'
);

alter function public.z420_ctl_unqualified() set search_path = '';

select is(
  (select pg_temp.run420_ctl() || '  [cfg ' || pg_temp.cfg420('public.z420_ctl_unqualified()') || ']'),
  '42P01  [cfg search_path=""]',
  '§ 6b ...AND THE SAME ALTER BREAKS IT (42P01, undefined_table): the empty path DOES remove `public` from relation resolution, so the four OK verdicts above are measurements of those bodies and not an instrument that cannot fail. ⛔ An `OK` here reads as VOID for §§ 1b/2b/3b/4b'
);

rollback to savepoint s420_ctl;

select * from finish();
rollback;
