-- ===========================================================================
-- Phase 8 — Dashboard aggregation (B2) + admin cross-commission overview (B5)
-- ===========================================================================
-- All reads are SECURITY DEFINER RPCs, internally gated (mirror ADR 0016:
-- list_signoff_queue / list_cases_board) — a per-call is_staff_admin_of / is_admin
-- check, then a set-based aggregation; non-entitled callers get an empty set, so
-- nothing leaks. search_path is pinned. They aggregate the canonical
-- "dashboard-countable responses" (status='submitted' AND case_phase_id IS NULL)
-- and key everything by question_key so a distribution spans form versions.
--
-- DECISION (ADR 0020): standalone form dashboards EXCLUDE case-phase responses
-- (case_phase_id IS NULL) so a form's own statistics never drift when a case
-- runs. The single source of this filter is app.submitted_form_responses below;
-- its TS twin lives in the query layer. The submissions browser (B3) INCLUDES
-- case-phase responses, badged — that path does NOT use this helper.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- app.submitted_form_responses(form_id) -> setof response  (THE canonical filter)
-- ---------------------------------------------------------------------------
-- The dashboard-countable responses of ONE form across ALL its versions:
-- submitted, standalone (not a case phase). Single-sourced so the rule is
-- expressed exactly once in SQL (Architecture Rule 9). Returns the full rows so
-- callers can date-bound on submitted_at / group by created_by without re-stating
-- the filter.
create function app.submitted_form_responses(p_form_id uuid)
returns setof public.responses
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select r.*
  from public.responses r
  join public.form_versions fv on fv.id = r.form_version_id
  where fv.form_id = p_form_id
    and r.status = 'submitted'
    and r.case_phase_id is null;
$$;

grant execute on function app.submitted_form_responses(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- app.latest_published_version(form_id) -> uuid
-- ---------------------------------------------------------------------------
-- The form's most recent published version id, used to resolve question_key ->
-- label / section title / positions (the "current wording" a distribution shows
-- even though it aggregates across versions). Falls back to the highest version
-- number of any status if none is published (defensive; a dashboard form always
-- has a published version in practice).
create function app.latest_published_version(p_form_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select id
  from public.form_versions
  where form_id = p_form_id
  order by (status = 'published') desc, version_number desc
  limit 1;
$$;

grant execute on function app.latest_published_version(uuid) to authenticated, service_role;

-- ===========================================================================
-- dashboard_form_totals(commission_id) -> setof (form_id, title, total_submitted)
-- ===========================================================================
-- Backs the dashboard form picker: forms of the commission with >=1 standalone
-- submitted response, newest-activity first. STAFF_ADMIN-gated.
create function public.dashboard_form_totals(p_commission_id uuid)
returns table (
  form_id uuid,
  title text,
  total_submitted bigint,
  last_submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select f.id,
         f.title,
         count(sr.id) as total_submitted,
         max(sr.submitted_at) as last_submitted_at
  from public.forms f
  cross join lateral app.submitted_form_responses(f.id) sr
  where f.commission_id = p_commission_id
  group by f.id, f.title
  having count(sr.id) > 0
  order by max(sr.submitted_at) desc nulls last, f.title;
end;
$$;

grant execute on function public.dashboard_form_totals(uuid) to authenticated, service_role;

-- ===========================================================================
-- dashboard_distributions(form_id, from, to) -> setof rows
-- ===========================================================================
-- One row per (question_key, option_value) for every CHOICE question of the
-- form, aggregated across all its standalone submitted responses (optionally
-- date-bounded on submitted_at). Checkbox values are unnested via
-- jsonb_array_elements_text so each selected option counts individually. Each
-- row carries the question's own denominator (distinct submitted responses with
-- >=1 answer in that question's SECTION — the conditional-aware applicability
-- base) and n (distinct responses that answered THIS question). Label / section
-- title / positions come from the latest published version (current wording).
-- STAFF_ADMIN-gated via the form's commission.
create function public.dashboard_distributions(
  p_form_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  question_key text,
  label text,
  section_title text,
  section_position integer,
  item_position integer,
  item_type text,
  option_value text,
  option_count bigint,
  denominator bigint,
  n bigint
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  v_latest := app.latest_published_version(p_form_id);

  return query
  with
  -- The in-scope (submitted, standalone, date-bounded) responses of the form.
  resp as (
    select sr.id, sr.form_version_id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  -- Every answer of those responses, joined to its authoring item so we know the
  -- item's section (for the denominator) and type (scalar vs checkbox).
  ans as (
    select a.response_id,
           a.question_key,
           a.value,
           fi.item_type,
           fi.section_id
    from public.answers a
    join resp on resp.id = a.response_id
    join public.form_items fi
      on fi.id = a.item_id
    where a.value is not null
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  -- Per-question_key denominator: distinct responses that answered ANY question
  -- in the SAME section (as authored in that response's own version). This gives
  -- the smaller applicability base for conditional-section questions.
  -- Map (response, section) -> answered-in-that-section, then attach to each
  -- question_key that lives in that section.
  section_answered as (
    select distinct response_id, section_id
    from ans
  ),
  -- question_key -> the set of (version, section) it appears in (from items of
  -- the in-scope responses' versions), so the denominator counts responses with
  -- an answer in THAT question's section for THAT version.
  key_section as (
    select distinct fi.question_key, fi.section_id
    from ans af
    join public.form_items fi on fi.question_key = af.question_key
    -- restrict to items in the versions actually used by in-scope responses
    where fi.form_version_id in (select distinct form_version_id from resp)
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  denom as (
    select ks.question_key,
           count(distinct sa.response_id) as denominator
    from key_section ks
    join section_answered sa on sa.section_id = ks.section_id
    group by ks.question_key
  ),
  -- Unnest checkbox values; pass scalar choice values through. Checkbox answers
  -- store a jsonb ARRAY (each selected option counts individually); scalar choice
  -- answers store a jsonb string. jsonb_array_elements_text would error on a
  -- scalar, so the lateral is fed an array ONLY for array-typed values and an
  -- empty array otherwise — scalars take the else branch.
  exploded as (
    select ans.question_key,
           case
             when jsonb_typeof(ans.value) = 'array' then elem.opt
             else ans.value #>> '{}'
           end as option_value,
           ans.response_id
    from ans
    left join lateral jsonb_array_elements_text(
      case when jsonb_typeof(ans.value) = 'array' then ans.value else '[]'::jsonb end
    ) as elem(opt)
      on jsonb_typeof(ans.value) = 'array'
    where jsonb_typeof(ans.value) <> 'array' or elem.opt is not null
  ),
  tally as (
    select e.question_key,
           e.option_value,
           count(*) as option_count
    from exploded e
    group by e.question_key, e.option_value
  ),
  n_per_key as (
    select ans.question_key as qk, count(distinct ans.response_id) as cnt
    from ans
    group by ans.question_key
  ),
  -- Current-wording metadata from the latest published version.
  meta as (
    select fi.question_key,
           fi.label,
           fs.title as section_title,
           fs.position as section_position,
           fi.position as item_position,
           fi.item_type
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  )
  select t.question_key,
         coalesce(m.label, t.question_key) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         coalesce(m.item_type, 'multiple_choice') as item_type,
         t.option_value,
         t.option_count,
         coalesce(d.denominator, 0) as denominator,
         coalesce(np.cnt, 0) as n
  from tally t
  left join meta m on m.question_key = t.question_key
  left join denom d on d.question_key = t.question_key
  left join n_per_key np on np.qk = t.question_key
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           t.question_key,
           t.option_value;
end;
$$;

grant execute on function public.dashboard_distributions(uuid, date, date)
  to authenticated, service_role;

-- ===========================================================================
-- dashboard_free_text(form_id, from, to, limit) -> setof rows
-- ===========================================================================
-- Free-text questions are not charted; this returns a capped sample of answers
-- plus the total count, one row per (question_key, sample_value). STAFF_ADMIN-
-- gated. Ordering puts the metadata-bearing rows first.
create function public.dashboard_free_text(
  p_form_id uuid,
  p_from date default null,
  p_to date default null,
  p_limit integer default 50
)
returns table (
  question_key text,
  label text,
  section_title text,
  section_position integer,
  item_position integer,
  total bigint,
  sample_value text
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  v_latest := app.latest_published_version(p_form_id);

  return query
  with
  resp as (
    select sr.id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  ans as (
    select a.question_key, a.value, a.response_id
    from public.answers a
    join resp on resp.id = a.response_id
    join public.form_items fi on fi.id = a.item_id
    where a.value is not null
      and fi.item_type = 'free_text'
  ),
  totals as (
    select ans.question_key as qk, count(*) as total from ans group by ans.question_key
  ),
  ranked as (
    select ans.question_key as qk,
           ans.value #>> '{}' as sample_value,
           row_number() over (partition by ans.question_key order by ans.response_id) as rn
    from ans
  ),
  meta as (
    select fi.question_key, fi.label, fs.title as section_title,
           fs.position as section_position, fi.position as item_position
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest
      and fi.item_type = 'free_text'
  )
  select r.qk as question_key,
         coalesce(m.label, r.qk) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         coalesce(tt.total, 0) as total,
         r.sample_value
  from ranked r
  left join totals tt on tt.qk = r.qk
  left join meta m on m.question_key = r.qk
  where r.rn <= greatest(p_limit, 1)
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           r.qk,
           r.rn;
end;
$$;

grant execute on function public.dashboard_free_text(uuid, date, date, integer)
  to authenticated, service_role;

-- ===========================================================================
-- dashboard_submissions_over_time(form_id, from, to) -> setof (day, count)
-- ===========================================================================
create function public.dashboard_submissions_over_time(
  p_form_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (day date, count bigint)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select sr.submitted_at::date as day, count(*) as count
  from app.submitted_form_responses(p_form_id) sr
  where (p_from is null or sr.submitted_at::date >= p_from)
    and (p_to   is null or sr.submitted_at::date <= p_to)
  group by sr.submitted_at::date
  order by day;
end;
$$;

grant execute on function public.dashboard_submissions_over_time(uuid, date, date)
  to authenticated, service_role;

-- ===========================================================================
-- dashboard_completion_by_member(form_id, from, to) -> setof (member_id, name, count)
-- ===========================================================================
create function public.dashboard_completion_by_member(
  p_form_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (member_id uuid, name text, count bigint)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select sr.created_by as member_id,
         pr.full_name as name,
         count(*) as count
  from app.submitted_form_responses(p_form_id) sr
  left join public.profiles pr on pr.id = sr.created_by
  where (p_from is null or sr.submitted_at::date >= p_from)
    and (p_to   is null or sr.submitted_at::date <= p_to)
  group by sr.created_by, pr.full_name
  order by count desc, pr.full_name;
end;
$$;

grant execute on function public.dashboard_completion_by_member(uuid, date, date)
  to authenticated, service_role;

-- ===========================================================================
-- commission_overview() -> setof rows   (B5 — admin cross-commission overview)
-- ===========================================================================
-- ADMIN-gated (mirror the dashboard gating but at the global-admin level). One
-- row per commission: distinct forms with a published version, total standalone
-- submitted responses, and the trailing-30-day count. Empty set for non-admins.
create function public.commission_overview()
returns table (
  commission_id uuid,
  commission_name text,
  slug text,
  form_count bigint,
  submitted_count bigint,
  submitted_last_30_days bigint
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if not app.is_admin() then
    return;
  end if;

  return query
  select c.id,
         c.name,
         c.slug::text,
         (select count(distinct f.id)
            from public.forms f
            join public.form_versions fv on fv.form_id = f.id and fv.status = 'published'
            where f.commission_id = c.id) as form_count,
         (select count(r.id)
            from public.responses r
            where r.commission_id = c.id
              and r.status = 'submitted'
              and r.case_phase_id is null) as submitted_count,
         (select count(r.id)
            from public.responses r
            where r.commission_id = c.id
              and r.status = 'submitted'
              and r.case_phase_id is null
              and r.submitted_at >= now() - interval '30 days') as submitted_last_30_days
  from public.commissions c
  order by c.name;
end;
$$;

grant execute on function public.commission_overview()
  to authenticated, service_role;
