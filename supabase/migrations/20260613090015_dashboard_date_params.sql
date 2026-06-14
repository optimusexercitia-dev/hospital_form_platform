-- ===========================================================================
-- Phase 8 — QA MINOR-1/MINOR-2: date-bound the CSV export + form-picker totals
-- ===========================================================================
-- The dashboard body already honors a date window (dashboard_distributions etc.
-- take p_from/p_to), but two reads did not, so a date-filtered dashboard showed
-- an unfiltered CSV (MINOR-1) and all-time tab badges (MINOR-2). This adds the
-- same optional date params (bound on submitted_at::date, mirroring
-- dashboard_distributions) to:
--   * dashboard_export_rows  -> the CSV export honors the active window;
--   * dashboard_form_totals  -> per-form tab totals respect the window.
--
-- Both gain a new argument, so the signature changes — DROP + CREATE (not
-- CREATE OR REPLACE). The params are OPTIONAL (default null = all-time) so
-- existing callers keep working until the frontend passes the range. The
-- 20260613090014 anon/PUBLIC EXECUTE revoke is RE-APPLIED to the new
-- dashboard_export_rows signature (the dropped function's grants do not carry to
-- the new one).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- dashboard_form_totals(commission_id, from, to)
-- ---------------------------------------------------------------------------
drop function if exists public.dashboard_form_totals(uuid);

create function public.dashboard_form_totals(
  p_commission_id uuid,
  p_from date default null,
  p_to date default null
)
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
    and (p_from is null or sr.submitted_at::date >= p_from)
    and (p_to   is null or sr.submitted_at::date <= p_to)
  group by f.id, f.title
  having count(sr.id) > 0
  order by max(sr.submitted_at) desc nulls last, f.title;
end;
$$;

grant execute on function public.dashboard_form_totals(uuid, date, date)
  to authenticated, service_role;
-- A DROP+CREATE'd function re-inherits the implicit PUBLIC EXECUTE grant (the
-- 090014 `alter default privileges` does not reliably suppress it for functions
-- created by the migration runner), so revoke it EXPLICITLY here — same pattern
-- as dashboard_export_rows below. Keeps "anon has zero EXECUTE on public" true.
revoke all on function public.dashboard_form_totals(uuid, date, date) from public, anon;

-- ---------------------------------------------------------------------------
-- dashboard_export_rows(form_id, from, to)
-- ---------------------------------------------------------------------------
drop function if exists public.dashboard_export_rows(uuid);

create function public.dashboard_export_rows(
  p_form_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  response_id uuid,
  member_name text,
  submitted_at timestamptz,
  version_number integer,
  answers jsonb,
  signoffs jsonb
)
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
  select r.id,
         pr.full_name as member_name,
         r.submitted_at,
         fv.version_number,
         -- answers: question_key -> display text. Arrays (checkbox) are joined
         -- with '; '; scalars are taken as text. Display items have no
         -- question_key (excluded by the join to answers).
         coalesce(
           (select jsonb_object_agg(
              a.question_key,
              case
                when jsonb_typeof(a.value) = 'array'
                  then (select string_agg(elem, '; ')
                        from jsonb_array_elements_text(a.value) as elem)
                else a.value #>> '{}'
              end)
            from public.answers a
            where a.response_id = r.id and a.value is not null),
           '{}'::jsonb) as answers,
         -- signoffs: section title -> 'Assinada' for every requires_signoff
         -- section of THIS response's version that has a sign-off row; 'Pendente'
         -- otherwise. Keyed by a stable label so the route can build columns.
         coalesce(
           (select jsonb_object_agg(
              coalesce(s.title, 'Seção ' || s.position::text),
              case when exists (
                select 1 from public.response_section_signoffs so
                where so.response_id = r.id and so.section_id = s.id
              ) then 'Assinada' else 'Pendente' end)
            from public.form_sections s
            where s.form_version_id = r.form_version_id
              and s.requires_signoff = true),
           '{}'::jsonb) as signoffs
  from app.submitted_form_responses(p_form_id) r
  join public.form_versions fv on fv.id = r.form_version_id
  left join public.profiles pr on pr.id = r.created_by
  where (p_from is null or r.submitted_at::date >= p_from)
    and (p_to   is null or r.submitted_at::date <= p_to)
  order by r.submitted_at desc;
end;
$$;

-- Re-apply the 090014 hardening to the new signature: authenticated +
-- service_role only, never anon / PUBLIC (anon inherits EXECUTE via PUBLIC, so
-- the explicit grant must be paired with the PUBLIC revoke).
grant execute on function public.dashboard_export_rows(uuid, date, date)
  to authenticated, service_role;
revoke all on function public.dashboard_export_rows(uuid, date, date) from public, anon;
