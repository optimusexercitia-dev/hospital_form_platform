-- =========================================================================
-- 364 — ADR 0137 D1: the Migration A backfill MAPPING, replayed against a
--       populated pre-state that the migration itself never sees locally.
--
-- ⭐ WHY THIS FILE EXISTS. `supabase db reset` runs migrations against an EMPTY
--    database and applies `seed.sql` AFTERWARDS, so Migration A's backfill
--    matches ZERO rows on every local run. Its correctness was therefore
--    asserted nowhere: the migration-time `$precheck$` in `20261003001400` also
--    matches zero rows locally, and any "every pre-existing true became
--    optional" assertion over seeded data would be measuring rows the backfill
--    never touched.
--
--    This file CONSTRUCTS THE STATE NOBODY CONSTRUCTS: it re-adds the retired
--    boolean columns inside a rolled-back transaction, populates them, and runs
--    the migration's own UPDATE statements over them.
--
-- ⛔ WHAT THIS PROVES AND WHAT IT DOES NOT. It proves the MAPPING — that the
--    expression sends `true` to 'optional', `false` to 'none', and nothing to
--    'required'. It does NOT prove the migration's execution against production
--    data: row counts, unanticipated NULLs, and constraint interactions at real
--    scale stay unproven until `db push`. This narrows the open item; it does
--    not close it, and it must not be reported as closing it.
--
-- ⛔ THE STATEMENTS BELOW ARE EXTRACTED FROM THE APPLIED MIGRATION, NOT RETYPED.
--    Verified 2026-08-23 with
--      `grep -n "patient_mode = case when" supabase/migrations/20261003001300_*.sql`
--    which returns exactly two lines, byte-identical to the two `set` clauses in
--    §2 below. The same grep over `20261003001400`'s `$precheck$` returns the
--    same two expressions, so the migration's own guard and this replay are
--    testing one expression, not two that happen to agree.
--    ⚠ RESIDUAL, STATED: this is a one-time authoring check, not a continuous
--      assertion — pgTAP runs inside the database and cannot read the repo. What
--      makes it durable is CLAUDE.md's forward-only rule: a migration that has
--      been applied is never edited, so the file cannot legitimately change. If
--      someone violates that rule, this file will NOT notice.
--
-- ⚠ TAKES BRIEF ACCESS EXCLUSIVE LOCKS on `process_template_versions` and
--   `cases` (add column / disable trigger). Everything is inside one
--   transaction that ends in ROLLBACK, so nothing survives — but a concurrent
--   long transaction on those tables will stall for the duration.
-- =========================================================================
begin;
select plan(14);

-- (0) FIXTURE REACHABILITY + the expression's totality.
-- ⚠ This file deliberately does NOT call `test_helpers.bootstrap()`. Bootstrap
--   TRUNCATEs the whole content cluster, which takes ACCESS EXCLUSIVE on ~40
--   tables; this test needs one commission, so it borrows a seeded one instead.
create temp table k on commit drop as
  select (select id from public.commissions order by created_at limit 1) as comm;
select isnt((select comm from k), null,
  '0.1 ORDERING/REACHABILITY GUARD: a seeded commission exists, so the fixture rows below can actually be created');

-- The mapping is TOTAL over the boolean domain and can never yield 'required' —
-- including on NULL, which the real pre-state could not contain (both columns
-- were NOT NULL) but which a future reader will wonder about.
select is(
  (select case when null::boolean then 'optional' else 'none' end),
  'none',
  '0.2 the mapping is TOTAL: even a NULL boolean yields ''none'', never ''required'' (ADR 0137 D1''s hard rule holds on the whole domain, not just the two reachable values)');

-- =========================================================================
-- (1) RECONSTRUCT THE PRE-MIGRATION STATE.
--
-- ⭐ THE POISON VALUES ARE THE ANTI-VACUITY DEVICE, AND WITHOUT THEM HALF THIS
--    FILE WOULD PROVE NOTHING. `patient_mode` DEFAULTS to 'none'. If the rows
--    were inserted at the default and the mapping then ran, the
--    `false -> 'none'` assertions would pass on a backfill that did nothing at
--    all — the column was already 'none' before the UPDATE.
--    So each row is CROSS-POISONED with the value it must NOT end up holding:
--    rows expected to become 'optional' start at 'none', rows expected to become
--    'none' start at 'optional'. Every arm must actively flip, and 1.7 asserts
--    that no row retained its poison.
-- =========================================================================
alter table public.process_template_versions add column collects_patient boolean not null default false;
alter table public.cases add column patient_enabled boolean not null default false;

-- ⚠ TWO templates, not one: `process_template_versions_one_draft_idx` permits a
--   single DRAFT per template, so both fixture versions cannot hang off one
--   identity. Splitting them keeps both rows `draft` and avoids dragging
--   publish-state semantics into a test about a mapping.
create temp table fx on commit drop as
  select gen_random_uuid() as tpl_a, gen_random_uuid() as tpl_b,
         gen_random_uuid() as v_true, gen_random_uuid() as v_false,
         gen_random_uuid() as c_true, gen_random_uuid() as c_false;

insert into public.process_templates (id, commission_id, created_by)
values ((select tpl_a from fx), (select comm from k), null),
       ((select tpl_b from fx), (select comm from k), null);

insert into public.process_template_versions
  (id, template_id, version_number, status, title, collects_patient, patient_mode)
values
  ((select v_true  from fx), (select tpl_a from fx), 901, 'draft', 'V true',  true,  'none'),
  ((select v_false from fx), (select tpl_b from fx), 902, 'draft', 'V false', false, 'optional');

insert into public.cases
  (id, commission_id, case_number, label, created_by, patient_enabled, patient_mode)
values
  ((select c_true  from fx), (select comm from k), 9901, 'C true',  null, true,  'none'),
  ((select c_false from fx), (select comm from k), 9902, 'C false', null, false, 'optional');

-- =========================================================================
-- (2) RUN THE MIGRATION'S OWN STATEMENTS.
--
-- Triggers are stood aside exactly as Migration A §3 does, and for the same two
-- reasons: `app.guard_published_template_version` honours no bypass flag, and
-- the Rule 11 audit triggers would emit a row per row touched. ⭐ A THIRD reason
-- exists now that did not when the migration ran:
-- `guard_case_patient_mode_immutable_trg` (Migration A §7) REFUSES any change to
-- `cases.patient_mode`, so the backfill statement is only replayable in the
-- pre-trigger state — which this reconstruction has to recreate too.
-- =========================================================================
-- ⚠ FLUSH THE PENDING DEFERRED EVENTS FIRST. The INSERTs above queued
--   `guard_case_patient_required_trg` (Migration A §6, DEFERRABLE INITIALLY
--   DEFERRED) for commit, and Postgres refuses `ALTER TABLE ... DISABLE TRIGGER`
--   on a table with pending trigger events. Forcing it here also VERIFIES the
--   fixture rows are legal under that guard before the mapping runs — both
--   fixture cases are 'none'/'optional', so nothing is required of them.
set constraints public.guard_case_patient_required_trg immediate;
set constraints public.guard_case_patient_required_trg deferred;

alter table public.process_template_versions disable trigger user;
alter table public.cases disable trigger user;

-- ⛔ The two `set` clauses below are byte-identical to
--    20261003001300 lines 95 and 98. Do not "tidy" them.
update public.process_template_versions
   set patient_mode = case when collects_patient then 'optional' else 'none' end;

update public.cases
   set patient_mode = case when patient_enabled then 'optional' else 'none' end;

alter table public.cases enable trigger user;
alter table public.process_template_versions enable trigger user;

-- =========================================================================
-- (3) THE THREE-WAY OUTCOME.
--     RED-PROOF (RUN): rewriting the cases arm to
--     `case when patient_enabled then 'optional' else 'optional' end` reds 1.4,
--     1.6 is unaffected, and 1.7 reds too — the poison control catches the same
--     defect independently.
-- =========================================================================
select is(
  (select patient_mode from public.process_template_versions where id = (select v_true from fx)),
  'optional',
  '1.1 template versions: collects_patient = true -> ''optional'' (poisoned to ''none'' first, so this required an actual write)');
select is(
  (select patient_mode from public.process_template_versions where id = (select v_false from fx)),
  'none',
  '1.2 template versions: collects_patient = false -> ''none'' (poisoned to ''optional'' first)');
select is(
  (select patient_mode from public.cases where id = (select c_true from fx)),
  'optional',
  '1.3 cases: patient_enabled = true -> ''optional'' (poisoned to ''none'' first)');
select is(
  (select patient_mode from public.cases where id = (select c_false from fx)),
  'none',
  '1.4 cases: patient_enabled = false -> ''none'' (poisoned to ''optional'' first)');

-- ADR 0137 D1's HARD RULE: a boolean carries no evidence that any existing
-- process intended MANDATORY collection, and guessing 'required' would
-- retroactively make every live case of that process un-createable.
--
-- ⚠⚠ 1.5 AND 1.6 ARE AN OUTCOME RECORD, NOT A GUARD, AND THE LABEL MATTERS.
--    MEASURED: against the REAL pre-state they are STRUCTURALLY GUARANTEED and
--    cannot fail. A mapping rewritten to emit 'required' does not land bad data
--    for them to catch — it ABORTS on
--    `process_template_versions_required_implies_mrn` (23514), because the
--    backfill writes only the mode and the required-field set is '{}' at that
--    point. Driving 1.5 red at all required constructing a state the migration
--    could never produce (pre-seeding `patient_required_fields` with 'mrn'),
--    which is the definition of a fixture that has left the subject behind.
--    They are kept because they are cheap and they pin the observed outcome;
--    the FALSIFIABLE form of the same rule is 1.8, which pins the mechanism that
--    actually enforces it.
select is(
  (select count(*)::int from public.process_template_versions where patient_mode = 'required'),
  0, '1.5 (outcome record, structurally guaranteed — see 1.8 for the falsifiable form) zero template versions land in ''required''');
select is(
  (select count(*)::int from public.cases where patient_mode = 'required'),
  0, '1.6 (outcome record, structurally guaranteed) zero cases land in ''required''');

-- The poison control, asserted explicitly rather than left implicit in 1.1-1.4.
select is(
  (select count(*)::int from (
     select 1 from public.process_template_versions
      where id = (select v_true from fx) and patient_mode = 'none'
     union all
     select 1 from public.process_template_versions
      where id = (select v_false from fx) and patient_mode = 'optional'
     union all
     select 1 from public.cases where id = (select c_true from fx) and patient_mode = 'none'
     union all
     select 1 from public.cases where id = (select c_false from fx) and patient_mode = 'optional'
   ) s),
  0, '1.7 ⭐ POISON CONTROL: no row still holds the value it started with, so 1.1-1.4 measured a WRITE and not a pre-existing default');

-- =========================================================================
-- (4) THE MIGRATION-TIME `$precheck$` FAILS LOUDLY — watched, not assumed.
--
-- ⭐ NEITHER HALF OF THIS HAD EVER BEEN OBSERVED FIRING. The precheck in
--    `20261003001400` is the ONLY thing standing between a bad backfill and the
--    irreversible drop of both booleans on the one run that matters (`db push`
--    against real data). A precheck that logged a warning and continued would be
--    indistinguishable from this one in every local run, because locally it
--    matches zero rows and returns silently either way.
--
--    Structurally confirmed first: the block is a single `begin ... end` with
--    four `raise exception` calls and NO `exception when` handler, so a mismatch
--    aborts the migration rather than being caught. §4 then drives each arm.
--
-- ⚠ The PREDICATES below are byte-identical to the migration's (same grep); the
--   surrounding `do` block is reproduced rather than copied, because pgTAP needs
--   each arm as a separate statement to assert on.
-- =========================================================================

-- 4.1 — corrupt ONE template version, then run arm 1.
alter table public.process_template_versions disable trigger user;
update public.process_template_versions set patient_mode = 'none'
 where id = (select v_true from fx);
alter table public.process_template_versions enable trigger user;

select throws_ok($q$
  do $chk$
  declare v_bad integer;
  begin
    select count(*) into v_bad
    from public.process_template_versions
    where patient_mode <> (case when collects_patient then 'optional' else 'none' end);
    if v_bad > 0 then
      raise exception
        'backfill mismatch: % process_template_versions rows disagree with collects_patient', v_bad
        using errcode = 'HC0T4';
    end if;
  end;
  $chk$;
$q$, 'HC0T4', null,
  '4.1 ⭐ the precheck RAISES (HC0T4) on a template-version mismatch — it aborts the migration rather than logging and proceeding to the irreversible DROP');

-- restore
alter table public.process_template_versions disable trigger user;
update public.process_template_versions set patient_mode = 'optional'
 where id = (select v_true from fx);
alter table public.process_template_versions enable trigger user;

-- 4.2 — corrupt ONE case, then run arm 2.
alter table public.cases disable trigger user;
update public.cases set patient_mode = 'optional' where id = (select c_false from fx);
alter table public.cases enable trigger user;

select throws_ok($q$
  do $chk$
  declare v_bad integer;
  begin
    select count(*) into v_bad
    from public.cases
    where patient_mode <> (case when patient_enabled then 'optional' else 'none' end);
    if v_bad > 0 then
      raise exception
        'backfill mismatch: % cases rows disagree with patient_enabled', v_bad
        using errcode = 'HC0T4';
    end if;
  end;
  $chk$;
$q$, 'HC0T4', null,
  '4.2 the precheck RAISES on a cases mismatch too — both arms, not just the first');

alter table public.cases disable trigger user;
update public.cases set patient_mode = 'none' where id = (select c_false from fx);
alter table public.cases enable trigger user;

-- 4.3 — a stray 'required' row, which no arm of the mapping can produce and
--       which therefore came from somewhere the migration must not paper over.
alter table public.process_template_versions disable trigger user;
update public.process_template_versions
   set patient_mode = 'required', patient_required_fields = array['mrn']
 where id = (select v_false from fx);
alter table public.process_template_versions enable trigger user;

select throws_ok($q$
  do $chk$
  declare v_bad integer;
  begin
    select count(*) into v_bad from public.process_template_versions where patient_mode = 'required';
    if v_bad > 0 then
      raise exception 'backfill produced % required-mode template versions (D1 forbids it)', v_bad
        using errcode = 'HC0T4';
    end if;
  end;
  $chk$;
$q$, 'HC0T4', null,
  '4.3 the precheck RAISES on a stray ''required'' row — D1''s rule is enforced at migration time, not merely documented');

alter table public.process_template_versions disable trigger user;
update public.process_template_versions
   set patient_mode = 'none', patient_required_fields = '{}'::text[]
 where id = (select v_false from fx);
alter table public.process_template_versions enable trigger user;

-- 4.4 — CONTROL. With the state consistent again the SAME blocks are silent, so
-- 4.1-4.3 measured the mismatch and not a block that always raises.
select lives_ok($q$
  do $chk$
  declare v_bad integer;
  begin
    select count(*) into v_bad
    from public.process_template_versions
    where patient_mode <> (case when collects_patient then 'optional' else 'none' end);
    if v_bad > 0 then raise exception 'tpl mismatch' using errcode = 'HC0T4'; end if;
    select count(*) into v_bad
    from public.cases
    where patient_mode <> (case when patient_enabled then 'optional' else 'none' end);
    if v_bad > 0 then raise exception 'case mismatch' using errcode = 'HC0T4'; end if;
    select count(*) into v_bad from public.process_template_versions where patient_mode = 'required';
    if v_bad > 0 then raise exception 'stray required' using errcode = 'HC0T4'; end if;
  end;
  $chk$;
$q$, '4.4 CONTROL: with the mapping consistent, all three arms are SILENT — so 4.1-4.3 measured a mismatch, not a block that raises unconditionally');

-- ⭐ 1.8 — THE MECHANISM THAT ACTUALLY ENFORCES D1, in falsifiable form.
--    What forbids a 'required' backfill is not the mapping expression's good
--    behaviour — it is the CHECK constraint, which makes a required-producing
--    backfill IMPOSSIBLE TO APPLY rather than merely wrong. Scoped to the two
--    fixture drafts so `app.guard_published_template_version` cannot answer
--    first with a different error and make this pass for the wrong reason.
--    RED-PROOF (RUN): dropping `process_template_versions_required_implies_mrn`
--    turns this into lives_ok.
select throws_ok($q$
  update public.process_template_versions
     set patient_mode = case when collects_patient then 'required' else 'none' end
   where version_number in (901, 902)
$q$, '23514', null,
  '1.8 ⭐ a backfill rewritten to emit ''required'' ABORTS on the required-implies-mrn CHECK rather than landing bad data — D1 is enforced by a constraint, not by the expression being well behaved');

select * from finish();
rollback;
