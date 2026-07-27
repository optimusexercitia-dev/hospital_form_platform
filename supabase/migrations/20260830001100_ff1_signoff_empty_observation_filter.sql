-- FF-1 (ADR 0087) — OUT-OF-PHASE FIX, ruled in by the lead during FF-2's gate.
--
-- `a.observation <> ''''` in SQL source is a comparison against a string literal
-- containing ONE APOSTROPHE. So the two per-instance filters in
-- `get_response_for_signoff` excluded observations equal to `'` — and let
-- EMPTY-STRING observations through, the precise opposite of their evident
-- intent. The top-level `observations_by_item` filter three lines away gets it
-- right (`btrim(a.observation) <> ''`), which is what makes this a quoting slip
-- rather than a design choice.
--
-- Carried byte-identical through 20260830001000 on purpose, so that migration
-- had no undeclared behaviour change, and reported instead. This migration is
-- the declared change.
--
-- SWEEP (lead-requested — a quoting slip is rarely unique). Across ALL schemas,
-- `prosrc like '%''''%'` matches exactly two functions:
--   · public.get_response_for_signoff        — 2 occurrences, THE BUG (fixed here)
--   · storage.list_multipart_uploads_with_delimiter — 3 occurrences, CORRECT:
--     they sit inside a dynamic-SQL string passed to EXECUTE (note the $4/$6
--     placeholders), where `''''` legitimately renders as `''`. Vendor code, and
--     a different construct — which is exactly why this was fixed by reading
--     each site rather than by a blind replace.
-- No RLS policy qual/with_check contains the pattern.
--
-- Body below is the live catalog definition with the two comparisons corrected
-- and nothing else touched.

CREATE OR REPLACE FUNCTION public.get_response_for_signoff(p_response_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_response public.responses;
  v_answers jsonb;
  v_has_pending boolean;
  v_result jsonb;
begin
  select * into v_response
  from public.responses
  where id = p_response_id;

  -- Gate 1: exists + in_progress. (unchanged)
  if v_response.id is null or v_response.status <> 'in_progress' then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Gate 2: coordinator/commission-admin of the response's commission OR a
  -- view_signoffs Administrativo (ADR 0061 — read-only parity with the queue).
  if not (app.is_staff_admin_of(v_response.commission_id)
          or app.is_commission_admin_of(v_response.commission_id)
          or app.member_can(v_response.commission_id, 'view_signoffs')) then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  v_answers := app.answer_map(p_response_id);

  -- Gate 3: there is a pending (visible + unsigned) staff_admin sign-off
  -- section. The read right is scoped to the act of signing. (unchanged)
  select exists (
    select 1
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
      and s.requires_signoff = true
      and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, v_answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = s.id
      )
  ) into v_has_pending;

  if not v_has_pending then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'response_id', v_response.id,
    'form_version_id', v_response.form_version_id,
    'commission_id', v_response.commission_id,
    'status', v_response.status,
    'form_id', (select fv.form_id from public.form_versions fv where fv.id = v_response.form_version_id),
    'form_title', (
      select f.title from public.forms f
      join public.form_versions fv on fv.form_id = f.id
      where fv.id = v_response.form_version_id),
    'respondent_id', v_response.created_by,
    'respondent_name', (select full_name from public.profiles where id = v_response.created_by),
    'started_at', v_response.started_at,
    'updated_at', v_response.updated_at,
    'answers', v_answers,
    'answers_by_item', app.answer_map_by_item(p_response_id),
    -- FF-2 (ADR 0089): the matrix grids. Without these the signer reviews a
    -- section whose matrix renders EMPTY, and signs it — the FF-1 `instances`
    -- lesson, one answer shape later.
    'matrix_cells_by_item', app.matrix_cells_by_item(p_response_id, null),
    'risk_matrix_by_item', app.risk_matrix_by_item(p_response_id, null),
    -- FF-1 (ADR 0087): the repeating-group instances. Without these the signer
    -- reviews a response with every instance answer missing, and signs it.
    'instances', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', gi.id,
               'group_item_id', gi.group_item_id,
               'position', gi.position,
               'answers', app.instance_answer_map(p_response_id, gi.id),
               'answers_by_item', app.answer_map_by_item_scoped(p_response_id, gi.id),
               'matrix_cells_by_item', app.matrix_cells_by_item(p_response_id, gi.id),
               'risk_matrix_by_item', app.risk_matrix_by_item(p_response_id, gi.id),
               'observations_by_item', coalesce((
                 select jsonb_object_agg(a.item_id::text, a.observation)
                 from public.answers a
                 where a.response_id = p_response_id
                   and a.group_instance_id = gi.id
                   and a.observation is not null and a.observation <> ''
               ), '{}'::jsonb),
               'other_text_by_item', coalesce((
                 select jsonb_object_agg(a.item_id::text, a.other_text)
                 from public.answers a
                 where a.response_id = p_response_id
                   and a.group_instance_id = gi.id
                   and a.other_text is not null and a.other_text <> ''
               ), '{}'::jsonb)
             ) order by gi.group_item_id, gi.position)
      from public.response_group_instances gi
      where gi.response_id = p_response_id
    ), '[]'::jsonb),
    'observations_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.observation)
       from public.answers a
       where a.response_id = p_response_id
         and a.observation is not null
         and btrim(a.observation) <> ''),
      '{}'::jsonb),
    'signoffs', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'section_id', so.section_id,
          'signed_by', so.signed_by,
          'signed_by_name', sp.full_name,
          'signed_at', so.signed_at,
          'note', so.note
        ) order by so.signed_at)
       from public.response_section_signoffs so
       join public.profiles sp on sp.id = so.signed_by
       where so.response_id = p_response_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;
