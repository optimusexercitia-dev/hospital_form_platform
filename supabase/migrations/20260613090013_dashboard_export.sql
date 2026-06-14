-- ===========================================================================
-- Phase 8 — B4: CSV export of raw submitted responses
-- ===========================================================================
-- One SECURITY DEFINER RPC (is_staff_admin_of / is_admin gated, mirror ADR 0016)
-- returning the raw standalone-submitted rows of a form for CSV assembly. Each
-- row carries the response metadata, an answers map (question_key -> display
-- text), and a sign-off status map (section title -> Assinada/Pendente) for the
-- form's signed sections. The route handler resolves the stable column set (one
-- column per question_key + one per signed section) from the form's latest
-- published version and emits the CSV with pt-BR headers + a UTF-8 BOM.
--
-- Standalone only (case-phase responses excluded — ADR 0020), so the export row
-- count matches the dashboard's totalSubmitted.
-- ===========================================================================

create function public.dashboard_export_rows(p_form_id uuid)
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
  order by r.submitted_at desc;
end;
$$;

grant execute on function public.dashboard_export_rows(uuid)
  to authenticated, service_role;
