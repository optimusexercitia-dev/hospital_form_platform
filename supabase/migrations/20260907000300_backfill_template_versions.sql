-- ADR 0096 — Process-template versioning · M3: the backfill.
--
-- Every existing process_templates row gets a v1 whose status maps
-- active -> published, draft -> draft, archived -> archived; children and cases
-- are re-pointed in the SAME transaction.
--
-- ============================================================================
-- WHY THIS MIGRATION CARRIES ITS OWN ASSERTIONS
-- ============================================================================
-- `supabase db reset` applies migrations and THEN seed.sql. The seed is what
-- creates every local template. So this backfill runs against ZERO ROWS on every
-- local reset, forever — it is structurally impossible for a green local reset
-- to tell us anything about whether it works. That is the 20260905 failure mode
-- restated as a permanent property of the pipeline, not a one-off mistake: that
-- backfill also passed a local reset against 0 rows and then failed `db push`
-- with a 23514 on the data-bearing remote.
--
-- Four compensating measures, of which two live in this file:
--   1. (here) The backfill is a FUNCTION invoked TWICE. The second invocation
--      must report zero changes, which proves idempotency on the real data
--      rather than asserting it in a comment.
--   2. (here) Post-conditions raise instead of warning. These execute during
--      `supabase db push` against the populated remote, which is the only place
--      the interesting data exists.
--   3. scripts/verify-tv-backfill.sh — a data-bearing rehearsal that resets at
--      the pre-TV commit (so the OLD seed loads real rows), then applies these
--      migrations with `supabase migration up`. MANDATORY and blocking before
--      any db push, because ADR 0096 ships without a feature flag.
--   4. Permanent invariant keystones in supabase/tests/297_*.sql, which run
--      against the seeded (new-shape) database on every test:db.
--
-- The helper is DROPPED at the end: leaving a SECURITY DEFINER function in the
-- catalog with no caller would be a new door for the ADR 0079 floor sweep to
-- flag, and it has no post-migration purpose.

create or replace function app.backfill_template_versions()
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_bad_status text;
  v_versions integer := 0;
  v_phases integer := 0;
  v_narratives integer := 0;
  v_outcomes integer := 0;
  v_fields integer := 0;
  v_cases integer := 0;
  v_offender text;
begin
  -- Pre-condition. A status outside the known three would otherwise map to NULL
  -- and surface as a confusing NOT NULL violation on the version row; name it.
  select t.status into v_bad_status
  from public.process_templates t
  where t.status not in ('draft', 'active', 'archived')
  limit 1;
  if found then
    raise exception 'backfill abortado: process_templates.status inesperado (%)', v_bad_status
      using errcode = 'check_violation';
  end if;

  -- 1. One v1 per template that does not have one yet. The NOT EXISTS is what
  --    makes a second invocation a no-op.
  with ins as (
    insert into public.process_template_versions (
      template_id, version_number, status, title, description,
      collects_patient, case_type_id, created_by, created_at, published_at
    )
    select
      t.id,
      1,
      case t.status
        when 'active' then 'published'
        when 'draft' then 'draft'
        when 'archived' then 'archived'
      end,
      t.title,
      t.description,
      t.collects_patient,
      t.case_type_id,
      t.created_by,
      t.created_at,
      -- A PROXY, not a record: the pre-versioning schema never stored a publish
      -- timestamp, and updated_at is the closest available. Anything more
      -- precise would be invention.
      case when t.status = 'active' then t.updated_at else null end
    from public.process_templates t
    where not exists (
      select 1 from public.process_template_versions v where v.template_id = t.id
    )
    returning 1
  )
  select count(*)::integer into v_versions from ins;

  -- 2. Re-point the four child tables onto that v1. Restricted to
  --    version_number = 1 so the statement stays deterministic if a template has
  --    since acquired further versions (a re-run after real authoring activity).
  update public.process_template_phases ph
  set template_version_id = v.id
  from public.process_template_versions v
  where v.template_id = ph.template_id
    and v.version_number = 1
    and ph.template_version_id is null;
  get diagnostics v_phases = row_count;

  update public.process_template_narratives n
  set template_version_id = v.id
  from public.process_template_versions v
  where v.template_id = n.template_id
    and v.version_number = 1
    and n.template_version_id is null;
  get diagnostics v_narratives = row_count;

  update public.process_template_outcomes o
  set template_version_id = v.id
  from public.process_template_versions v
  where v.template_id = o.template_id
    and v.version_number = 1
    and o.template_version_id is null;
  get diagnostics v_outcomes = row_count;

  update public.process_template_custom_fields f
  set template_version_id = v.id
  from public.process_template_versions v
  where v.template_id = f.template_id
    and v.version_number = 1
    and f.template_version_id is null;
  get diagnostics v_fields = row_count;

  -- 3. Re-point cases. `c.template_id is not null` deliberately skips both
  --    processless cases and the already-orphaned ones (ON DELETE SET NULL
  --    victims); neither can or should acquire a version.
  update public.cases c
  set template_version_id = v.id
  from public.process_template_versions v
  where v.template_id = c.template_id
    and v.version_number = 1
    and c.template_id is not null
    and c.template_version_id is null;
  get diagnostics v_cases = row_count;

  -- ---------------------------------------------------------------------
  -- Post-conditions. Fail LOUD, never silently no-op.
  -- ---------------------------------------------------------------------

  select t.id::text into v_offender
  from public.process_templates t
  where not exists (
    select 1 from public.process_template_versions v where v.template_id = t.id
  )
  limit 1;
  if found then
    raise exception 'backfill incompleto: template % ficou sem nenhuma versão', v_offender
      using errcode = 'check_violation';
  end if;

  select 'process_template_phases:' || ph.id::text into v_offender
  from public.process_template_phases ph where ph.template_version_id is null limit 1;
  if found then
    raise exception 'backfill incompleto: % sem template_version_id', v_offender
      using errcode = 'check_violation';
  end if;

  select 'process_template_narratives:' || n.id::text into v_offender
  from public.process_template_narratives n where n.template_version_id is null limit 1;
  if found then
    raise exception 'backfill incompleto: % sem template_version_id', v_offender
      using errcode = 'check_violation';
  end if;

  select 'process_template_outcomes:' || o.template_id::text into v_offender
  from public.process_template_outcomes o where o.template_version_id is null limit 1;
  if found then
    raise exception 'backfill incompleto: % sem template_version_id', v_offender
      using errcode = 'check_violation';
  end if;

  select 'process_template_custom_fields:' || f.id::text into v_offender
  from public.process_template_custom_fields f where f.template_version_id is null limit 1;
  if found then
    raise exception 'backfill incompleto: % sem template_version_id', v_offender
      using errcode = 'check_violation';
  end if;

  select c.id::text into v_offender
  from public.cases c
  where c.template_id is not null and c.template_version_id is null
  limit 1;
  if found then
    raise exception 'backfill incompleto: caso % tem processo mas ficou sem versão', v_offender
      using errcode = 'check_violation';
  end if;

  -- Tenancy coherence: a case must never end up pointing at a version owned by
  -- another commission. Nothing in the re-point could cause it, which is exactly
  -- why it is worth asserting — a silent cross-tenant re-point is the kind of
  -- defect that only ever shows up in production.
  select c.id::text into v_offender
  from public.cases c
  join public.process_template_versions v on v.id = c.template_version_id
  join public.process_templates t on t.id = v.template_id
  where t.commission_id <> c.commission_id
  limit 1;
  if found then
    raise exception 'backfill incoerente: caso % aponta para versão de outra comissão', v_offender
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object(
    'versions_created', v_versions,
    'phases_repointed', v_phases,
    'narratives_repointed', v_narratives,
    'outcomes_repointed', v_outcomes,
    'custom_fields_repointed', v_fields,
    'cases_repointed', v_cases
  );
end;
$$;

do $$
declare
  v_first jsonb;
  v_second jsonb;
  v_drift text;
begin
  v_first := app.backfill_template_versions();

  -- Idempotency is PROVEN, not asserted: run it again and require that the
  -- second pass touched nothing. On a fresh local reset both runs are all-zero
  -- (there is no data yet); on the remote the first run reports real counts and
  -- only the second must be zero.
  v_second := app.backfill_template_versions();

  select string_agg(key || '=' || value, ', ')
    into v_drift
  from jsonb_each_text(v_second)
  where value <> '0';

  if v_drift is not null then
    raise exception
      'backfill de versões de processo NÃO é idempotente: a segunda execução alterou linhas (%)',
      v_drift
      using errcode = 'check_violation';
  end if;

  raise notice 'ADR 0096 backfill: %', v_first;
end;
$$;

drop function app.backfill_template_versions();
