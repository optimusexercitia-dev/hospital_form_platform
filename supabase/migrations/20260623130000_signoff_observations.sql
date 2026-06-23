-- Form Builder Enhancements (BE-8) — observations on the sign-off read path.
-- ----------------------------------------------------------------------------
-- The staff_admin review-and-sign screen reads one in_progress response through
-- the narrow DEFINER RPC get_response_for_signoff. It already returns every
-- answer VALUE (answers_by_item); this adds the per-item observation note
-- (answers.observation, added in 20260623120000) as a sibling
-- `observations_by_item` projection so the read-only renderer can show the
-- observation line on this surface too (mirrors BE-7's submissions/fill paths).
--
-- PURELY ADDITIVE: the three access gates (in_progress + staff_admin-of-
-- commission + a pending visible staff_admin sign-off section) are reproduced
-- BYTE-FOR-BYTE — who may read and which response is returned are UNCHANGED.
-- This is a read-path payload of answer annotations the same caller already
-- receives all answer values for; no RLS/scope change. (Architecture Rule 11:
-- this is a read payload, not the audit log.)
-- ----------------------------------------------------------------------------

set search_path = public, pg_catalog;

create or replace function public.get_response_for_signoff(p_response_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
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

  -- Gate 2: caller is a staff_admin of the response's commission. (unchanged)
  if not app.is_staff_admin_of(v_response.commission_id) then
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
    'answers_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.value)
       from public.answers a
       where a.response_id = p_response_id and a.value is not null),
      '{}'::jsonb),
    -- NEW (BE-8): per-item observation notes (non-null, non-blank), keyed by
    -- item_id — the sibling of answers_by_item. Drives the observation line on
    -- the review-and-sign read surface.
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
$$;

alter function public.get_response_for_signoff(uuid) owner to postgres;
