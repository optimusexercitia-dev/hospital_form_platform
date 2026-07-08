-- ============================================================================
-- Administrativo (ADR 0061) — widen the signoff DRILL-IN read to view_signoffs
-- ============================================================================
-- list_signoff_queue was widened for the `view_signoffs` capability, but the
-- drill-in read behind a queue row — get_response_for_signoff — was still
-- coordinator-only (gate 2: `is_staff_admin_of`), so a view_signoffs holder saw the
-- queue yet 404'd on drill-in. Widen gate 2 to READ-ONLY parity with the queue:
--   is_staff_admin_of(c) OR is_commission_admin_of(c) OR app.member_can(c,'view_signoffs')
--
-- member_can is flag-aware (a dark flag confers nothing). The SIGNING path
-- (sign_section / app.can_sign_section) is deliberately UNCHANGED — view_signoffs
-- is read-only by construction (guardrail 4); the frontend already hides the sign
-- affordance for these holders.
--
-- Body byte-identical to 20260620000000_baseline.sql EXCEPT gate 2. Same signature
-- + RETURNS type, so CREATE OR REPLACE (no drop). Forward-only, additive; t19 grant
-- hygiene re-asserted (CREATE OR REPLACE resets the ACL).
-- ============================================================================

create or replace function public.get_response_for_signoff(p_response_id uuid)
  returns jsonb
  language plpgsql stable security definer
  set search_path to 'public', 'pg_catalog'
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
revoke all on function public.get_response_for_signoff(uuid) from public;
grant all on function public.get_response_for_signoff(uuid) to authenticated;
grant all on function public.get_response_for_signoff(uuid) to service_role;
