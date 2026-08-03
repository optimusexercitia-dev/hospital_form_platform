-- =============================================================================
-- FF-4 (ADR 0092) — Power Authoring, part 5 of 5: draft-start default
-- resolution (BE-6).
--
-- `app.resolve_default_source` — the pure per-token resolver (ruling 5): given
-- a token + the filling actor + the version's owning commission, returns the
-- scalar jsonb value to seed, or SQL NULL when it cannot resolve (e.g. an
-- actor with no full_name). INVOKER — it only reads `profiles`/`commissions`
-- rows the actor can already read under ordinary RLS (their own profile, and
-- the commission of the version they are about to fill), so there is no K9 /
-- DEFINER need here, unlike the two library doors.
--
-- `app.seed_default_answers` — writes a real `answers` row for every item in
-- a version with `default_source is not null` that does not already have one
-- (top-level only — group_instance_id is null; a dynamic default inside a
-- repeating group is out of scope, ADR 0092 says nothing about it and F3's
-- "case context deferred" spirit extends naturally here). ON CONFLICT DO
-- NOTHING against the SAME partial unique index `answers`' own writers use, so
-- it is safe to call more than once: idempotent, never overwrites an edited or
-- cleared answer (ADR 0092 ruling 5's "inherits default_value's existing
-- contract, rather than inventing one").
--
-- WIRED into `start_or_resume_response`'s CREATE branch ONLY — never the
-- RESUME branch, which returns before reaching it. That is "draft start" by
-- construction: a published version's items (and their default_source) are
-- immutable, so nothing could ever need re-seeding on a later resume. Full
-- body re-declared (not patched), per the `publish_form_version` precedent
-- (FF-2, 20260830000200) — the live catalog is the sole truth for a body a
-- later migration may have already rewritten, so this is read from
-- pg_get_functiondef at authoring time and reproduced verbatim plus the one
-- new `perform` line, rather than trusting migration file text.
--
-- SQLSTATE: allocates none (both functions are silent no-ops on a resolution
-- failure, never raise).
-- =============================================================================

create or replace function app.resolve_default_source(
  p_source text,
  p_actor uuid,
  p_commission_id uuid
)
returns jsonb
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_name text;
  v_email text;
  v_commission_name text;
begin
  if p_source = 'today' then
    return to_jsonb(current_date::text);
  elsif p_source = 'now' then
    return to_jsonb(to_char(clock_timestamp(), 'HH24:MI'));
  elsif p_source = 'current_user_name' then
    select p.full_name into v_name from public.profiles p where p.id = p_actor;
    return case when coalesce(v_name, '') = '' then null else to_jsonb(v_name) end;
  elsif p_source = 'current_user_email' then
    select p.email into v_email from public.profiles p where p.id = p_actor;
    return case when coalesce(v_email, '') = '' then null else to_jsonb(v_email) end;
  elsif p_source = 'commission_name' then
    select c.name into v_commission_name from public.commissions c where c.id = p_commission_id;
    return case when coalesce(v_commission_name, '') = '' then null else to_jsonb(v_commission_name) end;
  else
    -- Unknown token (should be unreachable — form_items_default_source_type_check
    -- pins the set): resolve to "no default" rather than raising, matching the
    -- rest of this phase's forgiving-reader convention (toDefaultSource's TS
    -- twin narrows an unknown value to null the same way).
    return null;
  end if;
end;
$$;

comment on function app.resolve_default_source(text, uuid, uuid) is
  'FF-4 (ADR 0092 ruling 5) — resolves ONE dynamic-default token to its scalar '
  'jsonb seed value. INVOKER: reads only the actor''s own profile and the '
  'version''s commission, both already RLS-readable by the filling user.';

create or replace function app.seed_default_answers(
  p_response_id uuid,
  p_form_version_id uuid,
  p_commission_id uuid,
  p_actor uuid
)
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('power_authoring') then
    return;
  end if;

  insert into public.answers (response_id, item_id, question_key, value, answered_at)
  select p_response_id, x.item_id, x.question_key, x.resolved, now()
  from (
    select i.id as item_id, i.question_key,
           app.resolve_default_source(i.default_source, p_actor, p_commission_id) as resolved
    from public.form_items i
    where i.form_version_id = p_form_version_id
      and i.default_source is not null
  ) x
  where x.resolved is not null
  on conflict (response_id, item_id) where group_instance_id is null
  do nothing;
end;
$$;

comment on function app.seed_default_answers(uuid, uuid, uuid, uuid) is
  'FF-4 (ADR 0092 ruling 5, BE-6) — seeds a real answers row for every '
  'top-level item carrying a default_source that does not already have one. '
  'Idempotent (ON CONFLICT DO NOTHING against answers'' own partial unique '
  'index): safe to call more than once, never overwrites an edited or cleared '
  'answer. Called ONLY from start_or_resume_response''s CREATE branch.';

-- -----------------------------------------------------------------------------
-- Re-declare start_or_resume_response IN FULL (body read from
-- pg_get_functiondef at authoring time, 2026-09-03), plus the one new
-- `perform` line in the CREATE branch. The RESUME branch above it is
-- untouched and still returns before this is ever reached.
-- -----------------------------------------------------------------------------
create or replace function public.start_or_resume_response(p_form_version_id uuid)
returns public.responses
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_status text;
  v_uid uuid := auth.uid();
  v_result public.responses;
begin
  -- Resolve the version's form/commission and its lifecycle status.
  select f.commission_id, v.status
    into v_commission_id, v_status
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = p_form_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  -- Server backstop: only published versions are fillable (the query layer
  -- lists published only, but a hand-crafted call must not start a draft on an
  -- unpublished/archived version).
  if v_status <> 'published' then
    raise exception 'este formulário não está publicado'
      using errcode = 'check_violation';
  end if;

  -- Resume: hand back the caller's existing in_progress draft if one exists.
  select * into v_result
  from public.responses
  where form_version_id = p_form_version_id
    and created_by = v_uid
    and status = 'in_progress';

  if v_result.id is not null then
    return v_result;
  end if;

  -- Create. The unique index guards against a concurrent create winning the
  -- race; on conflict, re-read and return the surviving draft.
  begin
    insert into public.responses (form_version_id, commission_id, created_by, status)
    values (p_form_version_id, v_commission_id, v_uid, 'in_progress')
    returning * into v_result;

    -- FF-4 (ADR 0092 ruling 5, BE-6): seed dynamic defaults exactly once, at
    -- creation. The RESUME branch above already returned for an existing
    -- draft, so this can never re-run against one -- draft-start by
    -- construction, not by a flag or a timestamp check.
    perform app.seed_default_answers(v_result.id, p_form_version_id, v_commission_id, v_uid);
  exception
    when unique_violation then
      select * into v_result
      from public.responses
      where form_version_id = p_form_version_id
        and created_by = v_uid
        and status = 'in_progress';
  end;

  return v_result;
end;
$function$;
