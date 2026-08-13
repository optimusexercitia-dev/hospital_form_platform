-- FF-2 (ADR 0089 · FUP-FF2-1) — the signer must see the grid.
--
-- `get_response_for_signoff` projected every answer shape EXCEPT the two matrix
-- tables, so a staff_admin reviewing a section containing a matrix saw the rest
-- of the response, an empty grid where the matrix should be — and then signed.
-- On an accreditation-governance platform a sign-off is an attestation, so a
-- reviewer attesting to content the screen never showed them is the sharp end of
-- the defect, not a cosmetic gap.
--
-- Exactly the FF-1 lesson repeating: that phase had to add `instances` to this
-- same payload for the same reason ("without these the signer reviews a response
-- with every instance answer missing, and signs it"). Every new answer shape owes
-- this projection; FF-5 will owe it for `answer_references`.
--
-- The two helpers are scope-parameterised (`p_instance_id`), mirroring
-- `app.answer_map_by_item_scoped`, so the top-level and per-instance projections
-- share one definition instead of four inline expressions that can drift.

-- ---------------------------------------------------------------------------
-- `{ "<item_id>": { "<row_code>": "<col_code>" } }` — the SAME shape the wizard
-- reads and writes (`matrixCellsByItemId`), addressed by clone-stable CODES on
-- both axes so the sign-off view can reuse the wizard's renderer unchanged.
-- ---------------------------------------------------------------------------
create or replace function app.matrix_cells_by_item(
  p_response_id uuid,
  p_instance_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(
    jsonb_object_agg(x.item_id::text, x.grid),
    '{}'::jsonb
  )
  from (
    select a.item_id, jsonb_object_agg(r.code, c.code) as grid
    from public.answer_matrix_cells amc
    join public.answers a on a.id = amc.answer_id
    join public.form_matrix_rows r on r.id = amc.row_id
    join public.form_matrix_columns c on c.id = amc.col_id
    where a.response_id = p_response_id
      and a.group_instance_id is not distinct from p_instance_id
    group by a.item_id
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- `{ "<item_id>": { "severity": …, "likelihood": …, "risk_score": … } }`.
-- `risk_score` is included because it is the DURABLE FACT the signer is
-- attesting to — recomputing it client-side from the axis weights would let a
-- later re-weighting silently change what a historical sign-off appears to say.
-- ---------------------------------------------------------------------------
create or replace function app.risk_matrix_by_item(
  p_response_id uuid,
  p_instance_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(
    jsonb_object_agg(
      a.item_id::text,
      jsonb_build_object(
        'severity', r.code,
        'likelihood', c.code,
        'risk_score', arm.risk_score
      )
    ),
    '{}'::jsonb
  )
  from public.answer_risk_matrix arm
  join public.answers a on a.id = arm.answer_id
  join public.form_matrix_rows r on r.id = arm.severity_row_id
  join public.form_matrix_columns c on c.id = arm.likelihood_col_id
  where a.response_id = p_response_id
    and a.group_instance_id is not distinct from p_instance_id;
$$;

-- ---------------------------------------------------------------------------
-- The payload gains four keys: the two maps at top level and the same two per
-- instance. Body is the current catalog text verbatim apart from those keys —
-- including the pre-existing `''''` comparisons in the per-instance
-- observation/other_text filters, kept byte-identical so this migration carries
-- NO undeclared behaviour change. (Those comparisons test against a literal
-- apostrophe rather than the empty string, so an empty-string observation is not
-- filtered out; reported separately rather than fixed here.)
-- ---------------------------------------------------------------------------
create or replace function public.get_response_for_signoff(p_response_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
                   and a.observation is not null and a.observation <> ''''
               ), '{}'::jsonb),
               'other_text_by_item', coalesce((
                 select jsonb_object_agg(a.item_id::text, a.other_text)
                 from public.answers a
                 where a.response_id = p_response_id
                   and a.group_instance_id = gi.id
                   and a.other_text is not null and a.other_text <> ''''
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
