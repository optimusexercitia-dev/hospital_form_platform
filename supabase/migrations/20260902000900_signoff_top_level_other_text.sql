-- =============================================================================
-- QA m-3 — the SIGN-OFF DOOR omitted top-level "Outros" free text.
--
-- `get_response_for_signoff` projected `other_text_by_item` INSIDE the instance
-- loop and nowhere else. A top-level "Outros" answer therefore reached the
-- signer as a bare chip with the respondent's typed text MISSING — they attest
-- to "Outro" without ever seeing what it said. On an accreditation platform a
-- sign-off is an attestation, so a field the screen never showed is the sharp
-- end of the defect, not a cosmetic gap.
--
-- ⚠ THIRD INSTANCE OF ONE SHAPE ON THIS EXACT SURFACE. FF-1 had to add
-- `instances` to this payload ("without these the signer reviews a response
-- with every instance answer missing, and signs it"); FF-2 had to add the two
-- matrix grids ("a reviewer attesting to content the screen never showed them
-- is the sharp end"); FF-5 added `references_by_item`. Each was found AFTER
-- shipping. The keystone in 276 §N is what stops a fourth.
--
-- ⚠ AND A SECOND DEFECT FOUND WHILE HERE, not reported and worse: the top-level
-- `observations_by_item` block had NO `group_instance_id` filter, so it folded
-- INSTANCE observations into the TOP-LEVEL map keyed by item_id — colliding
-- under jsonb_object_agg when two instances answer the same item, with one
-- winning arbitrarily. That is ADR 0087 substrate correction 5 (`app.answer_map`
-- folding instance answers into the top-level map) recurring in this door. The
-- TS readers (`getResponseForFill`, `getSubmissionDetail`) filter
-- `group_instance_id === null` correctly; only this DEFINER door did not. Fixed
-- in the same migration because it is one line in the expression being edited
-- and shipping a known wrong-data path to a signer is not defensible.
--
-- Body carried over from the LIVE pg_proc text (read 2026-07-28), not from any
-- migration file — 20260830001000's copy still carries the `<> ''''` filters
-- that 20260830001100 later corrected, so rebuilding from file would silently
-- revert that fix. CLAUDE.md graphify exception.
--
-- SQLSTATE: allocates none.
-- =============================================================================

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
    -- FF-5 (ADR 0091): the reference targets. Same lesson, one answer shape
    -- later again — a reference field renders EMPTY to the signer without this.
    'references_by_item', app.references_by_item(p_response_id, null),
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
               -- FF-5: the per-instance arm. A reference inside a repeating group
               -- reaches the signer through HERE and nowhere else.
               'references_by_item', app.references_by_item(p_response_id, gi.id),
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
    -- ⚠ `group_instance_id is null` IS A FIX, not a restatement. This block had
    -- NO scope filter, so it aggregated EVERY answer of the response — instance
    -- rows included — into the TOP-LEVEL map, keyed by item_id. Two instances
    -- carrying an observation on the same item collapse under jsonb_object_agg
    -- and one wins arbitrarily. That is ADR 0087 substrate correction 5 (the
    -- `app.answer_map` instance-fold) repeating in this door, and it is why the
    -- signer could see an instance's observation attached to a top-level
    -- question. The three per-instance blocks above were always scoped; only
    -- this one was not.
    'observations_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.observation)
       from public.answers a
       where a.response_id = p_response_id
         and a.group_instance_id is null
         and a.observation is not null
         and btrim(a.observation) <> ''),
      '{}'::jsonb),
    -- THE MISSING PROJECTION (QA m-3). The door emitted `other_text_by_item`
    -- per instance and NOT at top level, so a top-level "Outros" answer reached
    -- the signer as a bare chip with the typed free text GONE — they attest to
    -- "Outro" without ever seeing what the respondent wrote.
    --
    -- Third instance of one shape on this surface: FF-1 added `instances`,
    -- FF-2 added the matrix grids, FF-5 added `references_by_item`, and this is
    -- the same defect one field later. §N of 276_ff5_references.sql asserts it
    -- so there is not a fourth.
    'other_text_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.other_text)
       from public.answers a
       where a.response_id = p_response_id
         and a.group_instance_id is null
         and a.other_text is not null
         and btrim(a.other_text) <> ''),
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
