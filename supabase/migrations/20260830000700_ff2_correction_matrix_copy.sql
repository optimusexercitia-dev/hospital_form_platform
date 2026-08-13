-- FF-2 (ADR 0089 §B) — matrix answers survive a correction.
--
-- Confirmed live: NEITHER `supersede_response` NOR `start_correction_draft`
-- copies `answer_matrix_cells` or `answer_risk_matrix`. Both were correct only
-- while those tables were write-inert. FF-2 ships the writers, so a correction
-- would otherwise hand the corrector a draft with every grid blank — a silent
-- loss the user only discovers after re-submitting.
--
-- ⚠ THE JOIN IS THE WHOLE BUG. A correction gives the successor its OWN
-- `response_group_instances` rows (ADR 0087 Amendment 1.3), so any join matching
-- `new.group_instance_id` to `old.group_instance_id` is UNSATISFIABLE BY
-- CONSTRUCTION. That exact bug shipped in FF-1 as a P0 — proven live, 2
-- selections in, 0 out — and it fails SILENTLY (an insert of zero rows). Old→new
-- must resolve THROUGH the instance rows on the preserved
-- `(group_item_id, position)` identity, exactly as the shipped
-- `answer_selected_options` block does. `is not distinct from` makes NULL in →
-- NULL out, so a top-level answer still matches a top-level answer.
--
-- Two simplifications, stated so nobody over-builds:
--   · a correction reuses the SAME `form_version_id`, so `row_id` / `col_id`
--     need NO remap — only the answer→answer resolution;
--   · `risk_score` is copied VERBATIM, not recomputed, because the axis rows it
--     was derived from are the same immutable rows.
--
-- FF-1's K4 covers selections only. Nothing existing would have caught a repeat,
-- which is why `correction_copies_matrix_answers` asserts BY VALUE and ON THE
-- CORRECT INSTANCE rather than counting rows.
--
-- Both functions are re-declared in full; the bodies are the current catalog
-- text verbatim (including the pre-existing `''` quoting artifacts) plus the two
-- new blocks each.

create or replace function public.supersede_response(p_response_id uuid, p_reason text)
returns public.responses
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
  v_form_version uuid;
  v_status text;
  v_case_phase uuid;
  v_reason text;
  v_new public.responses;
begin
  perform app.assert_response_correction_enabled();

  -- Predecessor visible + exists → else no_data_found (RLS-safe not-found; this
  -- DEFINER function reads without RLS, so "visible" here means "exists" — the
  -- authority check right after is what actually gates who may act on it).
  select commission_id, form_version_id, status, case_phase_id
    into v_commission, v_form_version, v_status, v_case_phase
  from public.responses where id = p_response_id;

  if v_commission is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Authority: staff_admin or commission-admin of the predecessor's commission
  -- (the supersede_document gate). Checked BEFORE further preconditions so an
  -- unauthorized caller never learns anything about the row's state.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode corrigir respostas nesta comissão' using errcode = '42501';
  end if;

  -- Predecessor status = submitted (HC0H0) — an in_progress draft is edited directly.
  if v_status <> 'submitted' then
    raise exception 'apenas respostas enviadas podem ser corrigidas' using errcode = 'HC0H0';
  end if;

  -- Standalone-only (HC0H1) — case-wrapped responses are the case-phase
  -- lifecycle's to correct.
  if v_case_phase is not null then
    raise exception 'esta resposta pertence a um caso; a correção é feita pela fase do caso'
      using errcode = 'HC0H1';
  end if;

  -- No existing LIVE successor for this predecessor (HC0H2) — the clean
  -- pt-BR error; responses_one_successor_per_superseded backstops a direct
  -- double-insert race.
  if exists (select 1 from public.responses where supersedes_id = p_response_id) then
    raise exception 'já existe uma correção em andamento para esta resposta'
      using errcode = 'HC0H2';
  end if;

  -- Mandatory reason (HC0H3). Validated only — never written to the audit
  -- payload (Rule 11: free text in the un-erasable chain is an LGPD conflict).
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'informe o motivo da correção' using errcode = 'HC0H3';
  end if;

  -- No live in_progress draft of THIS form version already owned by the caller
  -- (HC0H5). The platform's responses_one_draft_per_user_idx allows only ONE
  -- in_progress standalone response per (form_version_id, created_by); a normal
  -- fill-in-progress OR another open correction on the same version would make
  -- the successor INSERT below collide (raw 23505). Pre-empt it with a clean,
  -- actionable pt-BR message. The unique index stays as the backstop.
  if exists (
    select 1 from public.responses
    where created_by = auth.uid()
      and form_version_id = v_form_version
      and status = 'in_progress'
      and case_phase_id is null
  ) then
    raise exception 'você já tem um preenchimento em andamento para esta versão do formulário; conclua ou descarte-o antes de corrigir'
      using errcode = 'HC0H5';
  end if;

  -- Insert the successor — form_version_id + commission_id copied from the
  -- predecessor (the coherence trigger re-verifies this); case_phase_id is
  -- always null (standalone); supersedes_id pre-links the chain.
  insert into public.responses (
    form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id
  ) values (
    v_form_version, v_commission, auth.uid(), 'in_progress', null, p_response_id
  )
  returning * into v_new;

  -- Pre-populate (O-1): copy the predecessor's saved scalar answers into the
  -- new draft (fresh ids, response_id repointed; answered_at reset to now() —
  -- it is a contemporaneous per-answer timestamp (ALCOA+), not a value to
  -- backdate). sync_answer_typed_values (BEFORE INSERT on answers) re-derives
  -- value_number/value_date/value_time from the copied value.
  -- FF-1 (ADR 0087 Amendment 1.3): see start_correction_draft — the instance
  -- rows are copied first and the answers remapped onto them.
  with src as (
    select id, group_item_id, position
    from public.response_group_instances
    where response_id = p_response_id
  ),
  ins as (
    insert into public.response_group_instances
      (response_id, group_item_id, parent_instance_id, position)
    select v_new.id, src.group_item_id, null, src.position
    from src
    returning id, group_item_id, position
  ),
  map as (
    select src.id as old_id, ins.id as new_id
    from src
    join ins on ins.group_item_id = src.group_item_id
            and ins.position = src.position
  )
  insert into public.answers (
    response_id, item_id, question_key, value, observation, other_text,
    group_instance_id, confidentiality_level
  )
  select
    v_new.id, a.item_id, a.question_key, a.value, a.observation, a.other_text,
    map.new_id, a.confidentiality_level
  from public.answers a
  left join map on map.old_id = a.group_instance_id
  where a.response_id = p_response_id;

  -- Copy choice selections (answer_selected_options hangs off answer_id, not
  -- response_id — join the just-copied answers back to their predecessor
  -- counterpart via (response_id, item_id, group_instance_id), which is the
  -- one-row-per-item key while repeating groups are inert).
  insert into public.answer_selected_options (answer_id, option_id)
  select new_a.id, aso.option_id
  from public.answer_selected_options aso
  join public.answers old_a on old_a.id = aso.answer_id
  join public.answers new_a
    on new_a.response_id = v_new.id
   and new_a.item_id = old_a.item_id
   -- FF-1 (P0-1): see start_correction_draft — resolve old->new through the
   -- instance rows, not through ids Amendment 1.3 made unequal on purpose.
   and new_a.group_instance_id is not distinct from (
         select ngi.id
         from public.response_group_instances ogi
         join public.response_group_instances ngi
           on ngi.response_id = v_new.id
          and ngi.group_item_id = ogi.group_item_id
          and ngi.position = ogi.position
         where ogi.id = old_a.group_instance_id
       )
  where old_a.response_id = p_response_id;

  -- FF-2 (ADR 0089 §B): matrix cells. Same instance-resolving join; row_id /
  -- col_id carry over unremapped because the successor reuses the SAME
  -- form_version_id.
  insert into public.answer_matrix_cells (answer_id, row_id, col_id, value)
  select new_a.id, amc.row_id, amc.col_id, amc.value
  from public.answer_matrix_cells amc
  join public.answers old_a on old_a.id = amc.answer_id
  join public.answers new_a
    on new_a.response_id = v_new.id
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from (
         select ngi.id
         from public.response_group_instances ogi
         join public.response_group_instances ngi
           on ngi.response_id = v_new.id
          and ngi.group_item_id = ogi.group_item_id
          and ngi.position = ogi.position
         where ogi.id = old_a.group_instance_id
       )
  where old_a.response_id = p_response_id;

  -- FF-2 (ADR 0089 §B): the risk answer. `risk_score` is copied VERBATIM, not
  -- recomputed — the axes it was derived from are the same immutable rows.
  insert into public.answer_risk_matrix
    (answer_id, severity_row_id, likelihood_col_id, risk_score)
  select new_a.id, arm.severity_row_id, arm.likelihood_col_id, arm.risk_score
  from public.answer_risk_matrix arm
  join public.answers old_a on old_a.id = arm.answer_id
  join public.answers new_a
    on new_a.response_id = v_new.id
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from (
         select ngi.id
         from public.response_group_instances ogi
         join public.response_group_instances ngi
           on ngi.response_id = v_new.id
          and ngi.group_item_id = ogi.group_item_id
          and ngi.position = ogi.position
         where ogi.id = old_a.group_instance_id
       )
  where old_a.response_id = p_response_id;

  perform app.audit_write(
    'response.superseded', 'response', p_response_id, v_commission,
    'Resposta corrigida',
    jsonb_build_object('successor_id', v_new.id)
  );

  return v_new;
end;
$function$;

create or replace function public.start_correction_draft(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text;
  v_status text; v_phase uuid; v_corrector uuid; v_draft uuid;
  v_predecessor uuid; v_fv uuid;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_phase_id,
         cr.permitted_corrector, cr.draft_response_id
    into v_case_id, v_commission, v_kind, v_status, v_phase, v_corrector, v_draft
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;
  if v_phase is null then
    raise exception 'esta solicitação não é de fase' using errcode = 'check_violation';
  end if;

  -- Authority: the designated corrector only.
  if auth.uid() is distinct from v_corrector then
    raise exception 'apenas o corretor designado pode iniciar o rascunho' using errcode = 'HC0M1';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  -- Idempotent resume: an existing draft is returned as-is.
  if v_status = 'in_progress' and v_draft is not null then
    return v_draft;
  end if;
  -- rejected → re-open the same (already in_progress) draft.
  if v_status = 'rejected' then
    perform set_config('app.in_correction_rpc', 'on', true);
    update public.case_correction_requests set status = 'in_progress' where id = p_request_id;
    perform set_config('app.in_correction_rpc', 'off', true);
    perform app.audit_write('case_correction.draft_started', 'case_correction_request',
      p_request_id, v_commission, 'Rascunho de correção retomado',
      jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase));
    return v_draft;
  end if;
  if v_status <> 'requested' then
    raise exception 'a solicitação não está no estado necessário para iniciar um rascunho'
      using errcode = 'check_violation';
  end if;

  -- Pin the predecessor = the phase's current revision; create the successor.
  select current_response_id, form_version_id into v_predecessor, v_fv
  from public.case_phases where id = v_phase;
  if v_predecessor is null then
    raise exception 'a fase não possui uma resposta atual para corrigir' using errcode = 'HC0M9';
  end if;

  -- The successor INSERT rides the guard_supersession_coherent corrector arm
  -- (open request with permitted_corrector = auth.uid()).
  insert into public.responses
    (form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
  select v_fv, v_commission, auth.uid(), 'in_progress', v_phase, v_predecessor
  returning id into v_draft;

  -- Copy the predecessor's answers + selections (supersede_response copy block).
  -- FF-1 (ADR 0087 Amendment 1.3): copy the predecessor''s repeating-group
  -- instances FIRST and remap the copied answers onto the NEW rows. Copying
  -- group_instance_id verbatim would leave the successor pointing at frozen,
  -- cascade-deleted instances of the predecessor.
  with src as (
    select id, group_item_id, position
    from public.response_group_instances
    where response_id = v_predecessor
  ),
  ins as (
    insert into public.response_group_instances
      (response_id, group_item_id, parent_instance_id, position)
    select v_draft, src.group_item_id, null, src.position
    from src
    returning id, group_item_id, position
  ),
  map as (
    select src.id as old_id, ins.id as new_id
    from src
    join ins on ins.group_item_id = src.group_item_id
            and ins.position = src.position
  )
  insert into public.answers
    (response_id, item_id, question_key, value, observation, other_text,
     group_instance_id, confidentiality_level)
  select v_draft, a.item_id, a.question_key, a.value, a.observation, a.other_text,
         map.new_id, a.confidentiality_level
  from public.answers a
  left join map on map.old_id = a.group_instance_id
  where a.response_id = v_predecessor;

  insert into public.answer_selected_options (answer_id, option_id)
  select new_a.id, aso.option_id
  from public.answer_selected_options aso
  join public.answers old_a on old_a.id = aso.answer_id
  join public.answers new_a
    on new_a.response_id = v_draft
   and new_a.item_id = old_a.item_id
   -- FF-1 (P0-1): the successor''s instance ids differ BY CONSTRUCTION from
   -- the predecessor''s (Amendment 1.3 gives it its own rows), so comparing the
   -- ids directly can never match an instance-scoped answer. Resolve through
   -- the instance rows on the preserved (group_item_id, position) identity.
   -- NULL in = NULL out, so top-level answers still match top-level.
   and new_a.group_instance_id is not distinct from (
         select ngi.id
         from public.response_group_instances ogi
         join public.response_group_instances ngi
           on ngi.response_id = v_draft
          and ngi.group_item_id = ogi.group_item_id
          and ngi.position = ogi.position
         where ogi.id = old_a.group_instance_id
       )
  where old_a.response_id = v_predecessor;

  -- FF-2 (ADR 0089 §B): matrix cells — same instance-resolving join.
  insert into public.answer_matrix_cells (answer_id, row_id, col_id, value)
  select new_a.id, amc.row_id, amc.col_id, amc.value
  from public.answer_matrix_cells amc
  join public.answers old_a on old_a.id = amc.answer_id
  join public.answers new_a
    on new_a.response_id = v_draft
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from (
         select ngi.id
         from public.response_group_instances ogi
         join public.response_group_instances ngi
           on ngi.response_id = v_draft
          and ngi.group_item_id = ogi.group_item_id
          and ngi.position = ogi.position
         where ogi.id = old_a.group_instance_id
       )
  where old_a.response_id = v_predecessor;

  -- FF-2 (ADR 0089 §B): the risk answer, `risk_score` verbatim.
  insert into public.answer_risk_matrix
    (answer_id, severity_row_id, likelihood_col_id, risk_score)
  select new_a.id, arm.severity_row_id, arm.likelihood_col_id, arm.risk_score
  from public.answer_risk_matrix arm
  join public.answers old_a on old_a.id = arm.answer_id
  join public.answers new_a
    on new_a.response_id = v_draft
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from (
         select ngi.id
         from public.response_group_instances ogi
         join public.response_group_instances ngi
           on ngi.response_id = v_draft
          and ngi.group_item_id = ogi.group_item_id
          and ngi.position = ogi.position
         where ogi.id = old_a.group_instance_id
       )
  where old_a.response_id = v_predecessor;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests
    set predecessor_response_id = v_predecessor, draft_response_id = v_draft,
        status = 'in_progress'
    where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  perform app.audit_write('case_correction.draft_started', 'case_correction_request',
    p_request_id, v_commission, 'Rascunho de correção iniciado',
    jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase));

  return v_draft;
end;
$function$;
