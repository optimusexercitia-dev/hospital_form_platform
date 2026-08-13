-- =============================================================================
-- FF-5 (ADR 0091 ruling 7) — Entity Reference, part 5 of 7: the CORRECTION COPY.
--
-- `answer_references` hangs off `answer_id` and is copied by NEITHER correction
-- RPC. That was correct while the table was write-inert (0 rows); the moment
-- part 2 shipped its writer it became a silent data-destroying bug, because a
-- correction gives the successor a fresh `answers` row and the reference stays
-- behind on the predecessor's.
--
-- ⚠ THE TRAP (FF-1's P0-1, verbatim). A correction gives the successor its OWN
-- `response_group_instances` rows (ADR 0087 Amendment 1.3), so any join matching
-- `new.group_instance_id` to `old.group_instance_id` is UNSATISFIABLE BY
-- CONSTRUCTION — it silently copies nothing for anything inside a repeating
-- group. That shipped once already: a correction destroyed every choice answer
-- in a repeating group, proven live 2 selections -> 0, and FF-1's own keystone
-- was blind to it because it counted `answers` rows against a short_text-only
-- fixture. old->new must resolve THROUGH the instance rows on the preserved
-- `(group_item_id, position)` identity.
--
-- ⚠ WHY THIS MIGRATION EXTRACTS INSTEAD OF APPENDING. The resolving subquery is
-- currently written out SIX times (2 RPCs x 3 child tables). Adding the
-- reference arm the obvious way would make it eight, and FF-4's library will
-- want a ninth. Six hand-copies of a join whose failure mode is "silently copies
-- nothing" is precisely the shape that produced P0-1 — the bug was not that
-- someone wrote the join wrong, it was that there were six places to write it.
-- So the whole copy (instances -> answers -> all four child tables) is extracted
-- into `app.copy_response_answers`, the resolving join is written ONCE, and both
-- RPCs call it. The existing FF-1 K4 and FF-2 `correction_copies_matrix_answers`
-- keystones prove the extraction is behaviour-preserving; FF-5's own
-- `correction_copies_reference_answers` proves the new arm.
--
-- SQLSTATE: allocates none.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The shared copy. Everything a successor response inherits from its
-- predecessor, in dependency order.
--
-- `answered_at` is intentionally NOT copied — it defaults to now(). It is a
-- contemporaneous per-answer timestamp (ALCOA+), not a value to backdate.
-- `sync_answer_typed_values` (BEFORE INSERT on answers) re-derives
-- value_number/value_date/value_time from the copied `value`.
-- `risk_score` IS copied verbatim rather than recomputed — the axes it was
-- derived from are the same immutable rows, because the successor reuses the
-- SAME form_version_id. For the same reason row_id / col_id / participant_id /
-- commission_id / profile_id all carry over unremapped.
-- `parent_instance_id` is written NULL, preserving the pre-existing behaviour
-- (nested instances are not copied) rather than quietly changing it here.
-- -----------------------------------------------------------------------------
create or replace function app.copy_response_answers(
  p_src_response_id uuid,
  p_dst_response_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  -- 1 · the successor's own instance rows, keyed by the preserved
  --     (group_item_id, position) identity that everything below resolves on.
  insert into public.response_group_instances
    (response_id, group_item_id, parent_instance_id, position)
  select p_dst_response_id, gi.group_item_id, null, gi.position
  from public.response_group_instances gi
  where gi.response_id = p_src_response_id;

  -- 2 · the answers, remapped onto those new instance rows. The correlated
  --     subquery yields NULL for a top-level answer (NULL in -> NULL out), so
  --     top-level stays top-level with no separate arm.
  insert into public.answers (
    response_id, item_id, question_key, value, observation, other_text,
    group_instance_id, confidentiality_level
  )
  select
    p_dst_response_id, a.item_id, a.question_key, a.value, a.observation,
    a.other_text,
    (select ngi.id
     from public.response_group_instances ogi
     join public.response_group_instances ngi
       on ngi.response_id = p_dst_response_id
      and ngi.group_item_id = ogi.group_item_id
      and ngi.position = ogi.position
     where ogi.id = a.group_instance_id),
    a.confidentiality_level
  from public.answers a
  where a.response_id = p_src_response_id;

  -- 3 · THE resolving join, written once. Every child table below is a plain
  --     join against this map, which is why adding a fifth answer shape is now
  --     a four-line insert rather than another hand-copied correlated subquery.
  create temp table _copy_answer_map (old_id uuid, new_id uuid) on commit drop;

  insert into _copy_answer_map (old_id, new_id)
  select old_a.id, new_a.id
  from public.answers old_a
  join public.answers new_a
    on new_a.response_id = p_dst_response_id
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from (
         select ngi.id
         from public.response_group_instances ogi
         join public.response_group_instances ngi
           on ngi.response_id = p_dst_response_id
          and ngi.group_item_id = ogi.group_item_id
          and ngi.position = ogi.position
         where ogi.id = old_a.group_instance_id
       )
  where old_a.response_id = p_src_response_id;

  -- 4 · the four answer-child shapes.
  insert into public.answer_selected_options (answer_id, option_id)
  select m.new_id, aso.option_id
  from public.answer_selected_options aso
  join _copy_answer_map m on m.old_id = aso.answer_id;

  -- FF-2 (ADR 0089 §B)
  insert into public.answer_matrix_cells (answer_id, row_id, col_id, value)
  select m.new_id, amc.row_id, amc.col_id, amc.value
  from public.answer_matrix_cells amc
  join _copy_answer_map m on m.old_id = amc.answer_id;

  insert into public.answer_risk_matrix
    (answer_id, severity_row_id, likelihood_col_id, risk_score)
  select m.new_id, arm.severity_row_id, arm.likelihood_col_id, arm.risk_score
  from public.answer_risk_matrix arm
  join _copy_answer_map m on m.old_id = arm.answer_id;

  -- FF-5 (ADR 0091 ruling 7) — the arm this migration exists for.
  insert into public.answer_references
    (answer_id, reference_kind, participant_id, commission_id, profile_id)
  select m.new_id, ar.reference_kind, ar.participant_id, ar.commission_id, ar.profile_id
  from public.answer_references ar
  join _copy_answer_map m on m.old_id = ar.answer_id;

  drop table _copy_answer_map;
end;
$$;

comment on function app.copy_response_answers(uuid, uuid) is
  'FF-5 (ADR 0091 ruling 7) — copies a predecessor response''s instances, answers and all '
  'four answer-child shapes onto a successor. Extracted from supersede_response / '
  'start_correction_draft, where the old->new instance-resolving join was written six '
  'times. Resolves through (group_item_id, position) because ADR 0087 Amendment 1.3 gives '
  'the successor its own instance rows, making a direct id comparison unsatisfiable by '
  'construction (FF-1 P0-1). Every new answer shape adds ONE insert here and nowhere else.';

-- -----------------------------------------------------------------------------
-- Both callers, now delegating. Everything outside the copy block is carried
-- over byte-for-byte from the live pg_proc bodies read on 2026-07-28.
-- -----------------------------------------------------------------------------
create or replace function public.supersede_response(p_response_id uuid, p_reason text)
returns public.responses
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

  -- Pre-populate (O-1): instances, answers, selections, matrix cells, the risk
  -- answer and (FF-5) references — all through the one shared copy.
  perform app.copy_response_answers(p_response_id, v_new.id);

  perform app.audit_write(
    'response.superseded', 'response', p_response_id, v_commission,
    'Resposta corrigida',
    jsonb_build_object('successor_id', v_new.id)
  );

  return v_new;
end;
$$;

create or replace function public.start_correction_draft(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

  -- Instances, answers, selections, matrix cells, the risk answer and (FF-5)
  -- references — all through the one shared copy.
  perform app.copy_response_answers(v_predecessor, v_draft);

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
$$;
