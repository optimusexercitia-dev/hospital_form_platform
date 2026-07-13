-- ============================================================================
-- S1·N · Notifications engine — event-driven hooks + auto-resolve wiring
-- (Phase 20; ADR 0076; build plan: docs/plans/notifications-s1.md §1.3/§1.5).
--
-- CREATE OR REPLACE on the exact LIVE function bodies (pulled from the running
-- local catalog via pg_get_functiondef, not the stale baseline.sql text — the
-- D11 status-key anglicization + later additive columns already changed
-- several of these) to splice in app.enqueue_notification /
-- app.resolve_notifications_for calls. Every other line is byte-for-byte the
-- pre-existing body; diff against the header comment of each block below to
-- see exactly what changed. All calls are no-ops when the `notifications`
-- flag is OFF (app.enqueue_notification / app.resolve_notifications_for both
-- self-check the flag), so this migration is inert until the companion
-- …000720 flip.
--
--   A. public.add_capa_action        -> capa/assigned (assignee, on create)
--   B. public.update_capa_action     -> capa/assigned (assignee changes on edit;
--                                        a small scope extension beyond the plan's
--                                        literal "action assignment" — same event
--                                        class, flagged in the plan-first message)
--   C. app.advance_capa_action_core  -> resolve on status -> completed/cancelled
--   D. public.save_section_answers   -> signoff/requested (staff_admin-role
--                                        sections only; one notif per response
--                                        per authorized signer, not per section)
--   E. public.sign_section           -> resolve when no staff_admin-role
--                                        pending section remains on the response
--   F. public.add_meeting_attendee   -> meeting/convoked (single attendee)
--   G. public.seed_expected_meeting_attendees  -> meeting/convoked (bulk, all members)
--   H. public.seed_selected_meeting_attendees  -> meeting/convoked (bulk, subset)
--   I. public.conclude_meeting       -> resolve 'upcoming' reminders
-- ============================================================================

-- -----------------------------------------------------------------------------
-- A · public.add_capa_action — enqueue capa/assigned when created with an
--     assignee. ADDED: the final `if v_row.assignee_user_id is not null` block.
-- -----------------------------------------------------------------------------
create or replace function public.add_capa_action(p_capa_id uuid, p_title text, p_owner text DEFAULT NULL::text, p_assignee_user_id uuid DEFAULT NULL::uuid, p_due_date date DEFAULT NULL::date, p_action_strength text DEFAULT 'intermediaria'::text, p_success_measure text DEFAULT NULL::text, p_root_cause_id uuid DEFAULT NULL::uuid)
  RETURNS capa_action
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row public.capa_action;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a ação corretiva' using errcode = 'check_violation';
  end if;
  if coalesce(p_action_strength, 'intermediaria') not in ('forte', 'intermediaria', 'fraca') then
    raise exception 'força da ação inválida' using errcode = 'check_violation';
  end if;
  if p_assignee_user_id is not null
     and not exists (select 1 from public.profiles where id = p_assignee_user_id) then
    raise exception 'responsável não encontrado' using errcode = 'no_data_found';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_plan set status = 'in_execution', updated_at = now()
  where id = p_capa_id and status = 'open';
  insert into public.capa_action (
    capa_id, title, owner, assignee_user_id, due_date, action_strength,
    success_measure, root_cause_id, position
  ) values (
    p_capa_id, btrim(p_title), p_owner, p_assignee_user_id, p_due_date,
    coalesce(p_action_strength, 'intermediaria'), p_success_measure, p_root_cause_id,
    coalesce((select max(position) from public.capa_action where capa_id = p_capa_id), 0) + 1
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);

  -- S1·N (ADR 0076): event-driven, non-suppressible assignment notification.
  -- commission_id is NULL — capa_action has no commission, only a hospital
  -- (via capa_plan), and the plan's schema keeps CAPA notifications
  -- commission-agnostic.
  if v_row.assignee_user_id is not null then
    perform app.enqueue_notification(
      v_row.assignee_user_id, null, 'capa', 'assigned', false, 'capa_action', v_row.id,
      'Nova ação CAPA atribuída a você', v_row.title, 'capa:' || v_row.id || ':assigned'
    );
  end if;

  return v_row;
end;
$function$;
alter function public.add_capa_action(uuid, text, text, uuid, date, text, text, uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- B · public.update_capa_action — enqueue capa/assigned on reassignment.
--     ADDED: v_old_assignee capture + the final reassignment-detection block.
-- -----------------------------------------------------------------------------
create or replace function public.update_capa_action(p_action_id uuid, p_title text, p_owner text DEFAULT NULL::text, p_assignee_user_id uuid DEFAULT NULL::uuid, p_due_date date DEFAULT NULL::date, p_action_strength text DEFAULT 'intermediaria'::text, p_success_measure text DEFAULT NULL::text, p_root_cause_id uuid DEFAULT NULL::uuid)
  RETURNS capa_action
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_capa_id uuid;
  v_old_assignee uuid;
  v_row public.capa_action;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id, assignee_user_id into v_capa_id, v_old_assignee from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a ação corretiva' using errcode = 'check_violation';
  end if;
  if coalesce(p_action_strength, 'intermediaria') not in ('forte', 'intermediaria', 'fraca') then
    raise exception 'força da ação inválida' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action
  set title = btrim(p_title), owner = p_owner, assignee_user_id = p_assignee_user_id,
      due_date = p_due_date, action_strength = coalesce(p_action_strength, 'intermediaria'),
      success_measure = p_success_measure, root_cause_id = p_root_cause_id, updated_at = now()
  where id = p_action_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);

  -- S1·N (ADR 0076): same event class as add_capa_action — reassignment to a
  -- NEW non-null assignee is still "action assignment". dedup_key is the same
  -- shape as the creation-time enqueue; a different assignee gets their own
  -- row (unique is per user_id), a re-save to the SAME assignee is a no-op.
  if p_assignee_user_id is not null and p_assignee_user_id is distinct from v_old_assignee then
    perform app.enqueue_notification(
      p_assignee_user_id, null, 'capa', 'assigned', false, 'capa_action', p_action_id,
      'Ação CAPA atribuída a você', v_row.title, 'capa:' || p_action_id || ':assigned'
    );
  end if;

  return v_row;
end;
$function$;
alter function public.update_capa_action(uuid, text, text, uuid, date, text, text, uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- C · app.advance_capa_action_core — auto-resolve on close. ADDED: the
--     `if p_status in ('completed', 'cancelled')` block before RETURN.
-- -----------------------------------------------------------------------------
create or replace function app.advance_capa_action_core(p_action_id uuid, p_status text)
  RETURNS capa_action
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_assignee uuid;
  v_capa_id uuid;
  v_uid uuid := auth.uid();
  v_result public.capa_action;
begin
  if p_status not in ('pending', 'in_progress', 'completed', 'cancelled') then
    raise exception 'estado de ação inválido' using errcode = 'check_violation';
  end if;

  select assignee_user_id, capa_id into v_assignee, v_capa_id
  from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação % não encontrada', p_action_id using errcode = 'no_data_found';
  end if;

  -- BUG-NSP-004: the PQS arm routes through can_write_capa, which owns the non-event
  -- fallback (event/rca-sourced -> per-HOSPITAL operator; manual/indicator/audit/
  -- meeting -> any-hospital, since a non-event CAPA has no hospital to scope to).
  -- Never re-implements the hospital resolution inline (would risk drift).
  if not (
    (v_assignee is not null and v_assignee = v_uid)
    or app.can_write_capa(v_capa_id, v_uid)
  ) then
    raise exception 'você não pode alterar esta ação corretiva' using errcode = 'HC050';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action
  set status = p_status,
      completed_at = case when p_status = 'completed' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'completed' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_id
  returning * into v_result;
  perform set_config('app.in_safety_rpc', 'off', true);

  -- S1·N (ADR 0076 decision 9): auto-resolve unresolved reminders on task
  -- completion. 'cancelled' also ends the actionable task (no more reminding
  -- makes sense once abandoned) — a deliberate small widening of the plan's
  -- literal "CAPA-close", flagged in the plan-first message.
  if p_status in ('completed', 'cancelled') then
    perform app.resolve_notifications_for('capa_action', p_action_id);
  end if;

  return v_result;
end;
$function$;
alter function app.advance_capa_action_core(uuid, text) owner to postgres;

-- -----------------------------------------------------------------------------
-- D · public.save_section_answers — enqueue signoff/requested. ADDED: the
--     final block after last_section_id/updated_at is saved, before RETURN.
--     Live signature includes p_other_text (post-baseline addition).
-- -----------------------------------------------------------------------------
create or replace function public.save_section_answers(p_response_id uuid, p_section_id uuid, p_answers jsonb DEFAULT '{}'::jsonb, p_clear_item_ids uuid[] DEFAULT NULL::uuid[], p_observations jsonb DEFAULT NULL::jsonb, p_selections jsonb DEFAULT NULL::jsonb, p_other_text jsonb DEFAULT NULL::jsonb)
  RETURNS responses
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_version_id uuid;
  v_status text;
  v_commission_id uuid;
  v_result public.responses;
  v_bad_item uuid;
  v_section_version uuid;
  v_bad_code text;
  v_pending_section_id uuid;
  v_pending_section_title text;
  v_signer uuid;
begin
  select form_version_id, status, commission_id into v_version_id, v_status, v_commission_id
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;

  select form_version_id into v_section_version
  from public.form_sections
  where id = p_section_id;

  if v_section_version is null or v_section_version <> v_version_id then
    raise exception 'a seção % não pertence a esta versão do formulário', p_section_id
      using errcode = 'HC013';
  end if;

  if p_answers is not null and p_answers <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_answers) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, e.value, null, now()
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set value = excluded.value,
                  question_key = excluded.question_key,
                  answered_at = now();
  end if;

  if p_selections is not null and p_selections <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_selections) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    select sel.code into v_bad_code
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(p_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    where not exists (
      select 1 from public.form_item_options o
      where o.item_id = sel.item_id and o.code = sel.code
    )
    limit 1;

    if v_bad_code is not null then
      raise exception 'a opção "%" não pertence a este item do formulário', v_bad_code
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, null, now()
    from jsonb_each(p_selections) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set answered_at = now();

    delete from public.answer_selected_options s
    using public.answers a
    where s.answer_id = a.id
      and a.response_id = p_response_id
      and a.group_instance_id is null
      and a.item_id in (select (e.key)::uuid from jsonb_each(p_selections) e);

    insert into public.answer_selected_options (answer_id, option_id)
    select a.id, o.id
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(p_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    join public.answers a
      on a.response_id = p_response_id
     and a.group_instance_id is null
     and a.item_id = sel.item_id
    join public.form_item_options o
      on o.item_id = sel.item_id and o.code = sel.code;
  end if;

  if p_observations is not null and p_observations <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_observations) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, observation, group_instance_id)
    select p_response_id, i.id, i.question_key,
           nullif(btrim(e.value #>> '{}'), ''), null
    from jsonb_each(p_observations) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set observation = excluded.observation;
  end if;

  -- ---- "Outros" open text. Upsert the parent answer row, then set other_text
  -- ONLY when the item's reserved __other__ option is among that item's CURRENT
  -- selections (post-selection-write above); otherwise force NULL (no stray text
  -- on an item whose Outro is not selected). ----
  if p_other_text is not null and p_other_text <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_other_text) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, now()
    from jsonb_each(p_other_text) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set answered_at = now();

    update public.answers a
    set other_text = case
      when exists (
        select 1
        from public.answer_selected_options s
        join public.form_item_options o on o.id = s.option_id
        where s.answer_id = a.id and o.is_other = true
      )
      then nullif(btrim(src.txt), '')
      else null
    end
    from (
      select (e.key)::uuid as item_id, e.value #>> '{}' as txt
      from jsonb_each(p_other_text) e
    ) src
    where a.response_id = p_response_id
      and a.group_instance_id is null
      and a.item_id = src.item_id;
  end if;

  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and item_id = any (p_clear_item_ids);
  end if;

  update public.responses
  set last_section_id = p_section_id,
      updated_at = now()
  where id = p_response_id
  returning * into v_result;

  -- S1·N (ADR 0076): event-driven "signoff/requested" — fires once per
  -- response (not per section) the first time a visible, unsigned
  -- staff_admin-role sign-off section exists AND the response is otherwise
  -- submit-ready (mirrors list_signoff_queue's own submit-readiness filter,
  -- so the notification never fires for a draft that couldn't be submitted
  -- yet even with the sign-off). respondent-role sections are excluded — that
  -- signer is the response's own creator, already in the wizard synchronously.
  -- Idempotent via app.enqueue_notification's dedup; safe to re-attempt on
  -- every save.
  if app.response_required_complete(p_response_id) then
    select s.id, s.title into v_pending_section_id, v_pending_section_title
    from public.form_sections s
    where s.form_version_id = v_version_id
      and s.requires_signoff = true and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, app.answer_map(p_response_id))
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id and so.section_id = s.id
      )
    order by s.position
    limit 1;

    if v_pending_section_id is not null then
      for v_signer in
        select principal_id from public.memberships
        where commission_id = v_commission_id and role = 'staff_admin'
      loop
        perform app.enqueue_notification(
          v_signer, v_commission_id, 'signoff', 'requested', false,
          'response_section_signoff', p_response_id,
          'Assinatura solicitada', coalesce(v_pending_section_title, ''),
          'signoff:' || p_response_id || ':requested'
        );
      end loop;
    end if;
  end if;

  return v_result;
end;
$function$;
alter function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb) owner to postgres;

-- -----------------------------------------------------------------------------
-- E · public.sign_section — auto-resolve when no staff_admin-role pending
--     section remains. ADDED: the block right before RETURN.
-- -----------------------------------------------------------------------------
create or replace function public.sign_section(p_response_id uuid, p_section_id uuid, p_note text DEFAULT NULL::text)
  RETURNS response_section_signoffs
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_status text;
  v_version_id uuid;
  v_requires_signoff boolean;
  v_visible_when jsonb;
  v_found boolean := false;
  v_answers jsonb;
  v_result public.response_section_signoffs;
begin
  -- Definer-rights metadata read (see header). No row -> response not found.
  for v_status, v_version_id, v_requires_signoff, v_visible_when in
    select t.status, t.version_id, t.requires_signoff, t.visible_when
    from app.signoff_target(p_response_id, p_section_id) t
  loop
    v_found := true;
  end loop;

  if not v_found then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser assinada'
      using errcode = 'check_violation';
  end if;

  if v_requires_signoff is null then
    raise exception 'seção % não pertence a esta resposta', p_section_id
      using errcode = 'check_violation';
  end if;

  if not v_requires_signoff then
    raise exception 'esta seção não exige assinatura'
      using errcode = 'check_violation';
  end if;

  v_answers := app.answer_map(p_response_id);
  if not app.eval_condition(v_visible_when, v_answers) then
    raise exception 'esta seção não está disponível para assinatura'
      using errcode = 'HC014';
  end if;

  begin
    insert into public.response_section_signoffs (response_id, section_id, signed_by, note)
    values (p_response_id, p_section_id, auth.uid(), nullif(btrim(p_note), ''))
    returning * into v_result;
  exception
    when unique_violation then
      raise exception 'esta seção já foi assinada'
        using errcode = 'HC015';
  end;

  -- S1·N (ADR 0076 decision 9): auto-resolve the response's signoff reminders
  -- once no staff_admin-role visible pending section remains (a response with
  -- MULTIPLE such sections keeps its reminder alive until the last one is
  -- signed). Harmless no-op when this sign was a respondent-role section (no
  -- 'requested' notification exists for those in the first place).
  if not exists (
    select 1 from public.form_sections s2
    where s2.form_version_id = v_version_id
      and s2.requires_signoff = true and s2.signoff_role = 'staff_admin'
      and app.eval_condition(s2.visible_when, v_answers)
      and not exists (
        select 1 from public.response_section_signoffs so2
        where so2.response_id = p_response_id and so2.section_id = s2.id
      )
  ) then
    perform app.resolve_notifications_for('response_section_signoff', p_response_id);
  end if;

  return v_result;
end;
$function$;
alter function public.sign_section(uuid, uuid, text) owner to postgres;

-- -----------------------------------------------------------------------------
-- F · public.add_meeting_attendee — enqueue meeting/convoked for a platform
--     attendee. ADDED: v_meeting_title lookup + the final convocation block.
-- -----------------------------------------------------------------------------
create or replace function public.add_meeting_attendee(p_meeting_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_external_name text DEFAULT NULL::text, p_external_org text DEFAULT NULL::text, p_role text DEFAULT 'membro'::text, p_attendance text DEFAULT 'summoned'::text, p_note text DEFAULT NULL::text)
  RETURNS meeting_attendees
  LANGUAGE plpgsql
  SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
  v_meeting_title text;
  v_result public.meeting_attendees;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);
  select title into v_meeting_title from public.meetings where id = p_meeting_id;

  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU um convidado externo, não os dois'
      using errcode = 'check_violation';
  end if;
  if p_user_id is not null and not app.is_member_of_for(v_commission_id, p_user_id) then
    raise exception 'o participante deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees
    (meeting_id, user_id, external_name, external_org, role, attendance, note)
  values
    (p_meeting_id, p_user_id, nullif(btrim(p_external_name), ''), nullif(btrim(p_external_org), ''),
     coalesce(p_role, 'membro'), coalesce(p_attendance, 'summoned'), nullif(btrim(p_note), ''))
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  -- S1·N (ADR 0076): event-driven, non-suppressible convocation notification.
  -- External guests (p_user_id null) have no platform account to notify.
  if p_user_id is not null then
    perform app.enqueue_notification(
      p_user_id, v_commission_id, 'meeting', 'convoked', false, 'meeting', p_meeting_id,
      'Você foi convocado para uma reunião', v_meeting_title, 'meeting:' || p_meeting_id || ':convoked'
    );
  end if;

  return v_result;
end;
$function$;
alter function public.add_meeting_attendee(uuid, uuid, text, text, text, text, text) owner to postgres;

-- -----------------------------------------------------------------------------
-- G · public.seed_expected_meeting_attendees — enqueue meeting/convoked for
--     every NEWLY-inserted attendee (ON CONFLICT DO NOTHING rows are skipped
--     via the RETURNING-driven loop, so a re-seed never double-notifies).
-- -----------------------------------------------------------------------------
create or replace function public.seed_expected_meeting_attendees(p_meeting_id uuid)
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_meeting_title text;
  v_new_user_id uuid;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);
  select title into v_meeting_title from public.meetings where id = p_meeting_id;
  perform set_config('app.in_meeting_rpc', 'on', true);
  for v_new_user_id in
    insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
    select p_meeting_id, m.principal_id, 'membro', 'summoned'
    from public.memberships m
    where m.commission_id = v_commission_id
    on conflict (meeting_id, user_id) where user_id is not null do nothing
    returning user_id
  loop
    perform app.enqueue_notification(
      v_new_user_id, v_commission_id, 'meeting', 'convoked', false, 'meeting', p_meeting_id,
      'Você foi convocado para uma reunião', v_meeting_title, 'meeting:' || p_meeting_id || ':convoked'
    );
  end loop;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$function$;
alter function public.seed_expected_meeting_attendees(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- H · public.seed_selected_meeting_attendees — same treatment as G, subset.
-- -----------------------------------------------------------------------------
create or replace function public.seed_selected_meeting_attendees(p_meeting_id uuid, p_user_ids uuid[])
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_meeting_title text;
  v_new_user_id uuid;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);
  select title into v_meeting_title from public.meetings where id = p_meeting_id;
  perform set_config('app.in_meeting_rpc', 'on', true);
  for v_new_user_id in
    insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
    select p_meeting_id, m.principal_id, 'membro', 'summoned'
    from public.memberships m
    where m.commission_id = v_commission_id
      and m.principal_id = any (coalesce(p_user_ids, '{}'::uuid[]))
    on conflict (meeting_id, user_id) where user_id is not null do nothing
    returning user_id
  loop
    perform app.enqueue_notification(
      v_new_user_id, v_commission_id, 'meeting', 'convoked', false, 'meeting', p_meeting_id,
      'Você foi convocado para uma reunião', v_meeting_title, 'meeting:' || p_meeting_id || ':convoked'
    );
  end loop;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$function$;
alter function public.seed_selected_meeting_attendees(uuid, uuid[]) owner to postgres;

-- -----------------------------------------------------------------------------
-- I · public.conclude_meeting — auto-resolve 'upcoming' reminders. ADDED: the
--     app.resolve_notifications_for call right before the RPC-scope OFF/RETURN.
-- -----------------------------------------------------------------------------
create or replace function public.conclude_meeting(p_meeting_id uuid, p_held_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_held_end timestamp with time zone DEFAULT NULL::timestamp with time zone)
  RETURNS meetings
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
  v_status text;
  v_rule text;
  v_value numeric;
  v_present integer;
  v_eligible integer;
  v_quorum_met boolean;
  v_result public.meetings;
  r_link record;
begin
  perform app.assert_meetings_enabled();
  select commission_id, status into v_commission_id, v_status
  from public.meetings where id = p_meeting_id;
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status not in ('scheduled', 'held') then
    raise exception 'apenas reuniões agendadas ou realizadas podem ser concluídas'
      using errcode = 'HC033';
  end if;
  if p_held_end is not null and p_held_at is null then
    raise exception 'informe o início da realização antes do término da reunião'
      using errcode = 'HC084';
  end if;
  if p_held_end is not null and p_held_at is not null and p_held_end < p_held_at then
    raise exception 'o horário de término não pode ser anterior ao horário de início da reunião'
      using errcode = 'HC081';
  end if;
  if p_held_at is not null and p_held_at > now() then
    raise exception 'a data e hora de realização não podem estar no futuro'
      using errcode = 'HC082';
  end if;

  select count(*) into v_eligible
  from public.memberships where commission_id = v_commission_id;
  select count(*) into v_present
  from public.meeting_attendees
  where meeting_id = p_meeting_id and attendance = 'present' and user_id is not null;

  if v_present < 1 then
    raise exception 'registre ao menos um participante presente antes de concluir'
      using errcode = 'HC034';
  end if;

  select quorum_rule_type, quorum_value into v_rule, v_value
  from public.commission_meeting_settings where commission_id = v_commission_id;
  v_rule := coalesce(v_rule, 'maioria_simples');

  v_quorum_met := case v_rule
    when 'maioria_simples' then v_present > v_eligible / 2.0
    when 'fixed_count' then v_present >= coalesce(v_value, 0)
    when 'percentage' then v_present >= ceil(v_eligible * coalesce(v_value, 0) / 100.0)
    else false
  end;

  perform set_config('app.in_meeting_rpc', 'on', true);
  if v_status = 'scheduled' then
    update public.meetings
    set status = 'held', held_at = p_held_at, held_end = p_held_end, updated_at = now()
    where id = p_meeting_id;
  else
    update public.meetings
    set held_at = p_held_at, held_end = p_held_end, updated_at = now()
    where id = p_meeting_id;
  end if;

  update public.meetings
  set status = 'in_signature',
      quorum_rule_type = v_rule, quorum_value = v_value,
      present_count = v_present, eligible_member_count = v_eligible, quorum_met = v_quorum_met,
      concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
  where id = p_meeting_id
  returning * into v_result;

  for r_link in
    select mc.case_id, mc.summary, mc.decision, m.meeting_number
    from public.meeting_cases mc
    join public.meetings m on m.id = mc.meeting_id
    where mc.meeting_id = p_meeting_id
  loop
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      r_link.case_id, 'meeting',
      'Discutido na Reunião nº ' || r_link.meeting_number,
      coalesce(
        nullif(btrim(concat_ws(E'\n\n',
          nullif(btrim(r_link.summary), ''),
          case when nullif(btrim(r_link.decision), '') is not null
               then 'Decisão: ' || btrim(r_link.decision) end
        )), ''),
        'Caso discutido nesta reunião.'
      ),
      current_date, auth.uid()
    );
  end loop;

  -- S1·N (ADR 0076 decision 9): once concluded, an 'upcoming' reminder is
  -- moot — clear it. Assignments (none exist for the 'meeting' surface — the
  -- only non-reminder milestone is 'convoked', which persists as history)
  -- are untouched regardless.
  perform app.resolve_notifications_for('meeting', p_meeting_id);

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$function$;
alter function public.conclude_meeting(uuid, timestamptz, timestamptz) owner to postgres;
