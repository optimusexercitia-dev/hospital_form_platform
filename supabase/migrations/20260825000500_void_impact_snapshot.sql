-- Case Correction Lifecycle — BE-7 / MINOR-1: stamp impact_snapshot on VOID approvals.
--
-- The correction/addendum approval arm stamps impact_snapshot (downstream phases at
-- approval time); the phase-VOID arm did not, even though a void has the largest
-- downstream effect (it clears a result downstream phases may have consumed). ADR
-- 0085 §7 words the snapshot generally ("stamped at approval"), so the void arm now
-- stamps it the SAME way — computed BEFORE the completed→voided update so the
-- "downstream at approval" is captured pre-effect. No other arm changes. The
-- narrative arms have no downstream phases and remain unstamped (v_impact null).
--
-- Reproduced from the LIVE catalog body; only the phase-void arm is edited.

create or replace function public.approve_correction(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text; v_status text;
  v_phase uuid; v_narr uuid; v_requested_by uuid; v_corrector uuid;
  v_draft uuid; v_body text;
  v_self boolean;
  v_draft_status text; v_draft_super uuid; v_cur uuid;
  v_position int; v_impact jsonb; v_old_body text; v_revnum int;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_phase_id,
         cr.case_narrative_id, cr.requested_by, cr.permitted_corrector,
         cr.draft_response_id, cr.draft_body_md
    into v_case_id, v_commission, v_kind, v_status, v_phase, v_narr,
         v_requested_by, v_corrector, v_draft, v_body
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas administradores podem aprovar correções' using errcode = '42501';
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
  -- Void is decided directly from 'requested' (no draft/resubmit); other kinds
  -- require the corrector to have resubmitted.
  if (v_kind = 'void' and v_status not in ('requested', 'under_review'))
     or (v_kind <> 'void' and v_status not in ('resubmitted', 'under_review')) then
    raise exception 'a solicitação não está no estado necessário para aprovação'
      using errcode = 'check_violation';
  end if;

  v_self := auth.uid() in (v_requested_by, v_corrector);

  if v_phase is not null then
    -- ===== PHASE arms =====
    select cp.position, cp.current_response_id into v_position, v_cur
    from public.case_phases cp where cp.id = v_phase;

    if v_kind = 'void' then
      -- (b) phase void. Stamp impact_snapshot the same way the correction arm does,
      -- BEFORE the effect (a void clears a result downstream phases may have used).
      select coalesce(jsonb_agg(jsonb_build_object(
                'id', cp2.id, 'position', cp2.position, 'title', cp2.title,
                'status', cp2.status, 'result_id', cp2.result_id) order by cp2.position), '[]'::jsonb)
        into v_impact
      from public.case_phases cp2
      where cp2.case_id = v_case_id and cp2.position > v_position
        and cp2.status in ('active', 'completed');

      perform set_config('app.in_case_rpc', 'on', true);
      update public.case_phases
        set status = 'voided', result_id = null, result_source = null,
            result_computed_at = null
        where id = v_phase;
      perform set_config('app.in_case_rpc', 'off', true);
      perform public.recompute_recommendations(v_case_id);
    else
      -- (a) phase correction / addendum: verify the submitted successor is the
      -- chain tip, stamp impact, re-point, recompute.
      select status, supersedes_id into v_draft_status, v_draft_super
      from public.responses where id = v_draft;
      if v_draft_status is distinct from 'submitted' or v_draft_super is distinct from v_cur then
        raise exception 'o rascunho da correção não está pronto para aprovação (a fase mudou)'
          using errcode = 'HC0M9';
      end if;

      select coalesce(jsonb_agg(jsonb_build_object(
                'id', cp2.id, 'position', cp2.position, 'title', cp2.title,
                'status', cp2.status, 'result_id', cp2.result_id) order by cp2.position), '[]'::jsonb)
        into v_impact
      from public.case_phases cp2
      where cp2.case_id = v_case_id and cp2.position > v_position
        and cp2.status in ('active', 'completed');

      perform set_config('app.in_case_rpc', 'on', true);
      update public.case_phases set current_response_id = v_draft where id = v_phase;
      perform set_config('app.in_case_rpc', 'off', true);

      begin
        perform app.compute_case_phase_result(v_phase);
      exception when others then
        if sqlstate = 'HC061' then
          raise exception 'defina o resultado da fase antes de aprovar' using errcode = 'HC061';
        end if;
        raise;
      end;
      perform public.recompute_recommendations(v_case_id);
    end if;
  else
    -- ===== NARRATIVE arms =====
    select coalesce(max(revision_number), 0) + 1 into v_revnum
    from public.case_narrative_revisions where case_narrative_id = v_narr;
    select body_md into v_old_body from public.case_narratives where id = v_narr;

    -- Snapshot the OLD body (append-only; requires app.in_correction_rpc).
    perform set_config('app.in_correction_rpc', 'on', true);
    insert into public.case_narrative_revisions
      (case_narrative_id, correction_request_id, revision_number, body_md, snapshotted_by)
    values (v_narr, p_request_id, v_revnum, coalesce(v_old_body, ''), auth.uid());
    perform set_config('app.in_correction_rpc', 'off', true);

    perform set_config('app.in_narrative_rpc', 'on', true);
    if v_kind = 'void' then
      -- (d) narrative void: keep concluded_at/by; status → voided.
      update public.case_narratives set status = 'voided', updated_by = auth.uid()
        where id = v_narr;
    else
      -- (c) narrative correction/addendum: swap body; concluded_at/by UNTOUCHED.
      update public.case_narratives set body_md = v_body, updated_by = auth.uid()
        where id = v_narr;
    end if;
    perform set_config('app.in_narrative_rpc', 'off', true);
  end if;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests
    set status = 'approved', self_approved = v_self, impact_snapshot = v_impact,
        resolved_by = auth.uid(), resolved_at = now()
    where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  perform app.audit_write('case_correction.approved', 'case_correction_request',
    p_request_id, v_commission,
    'Correção aprovada' || case when v_self then ' (autoaprovação)' else '' end,
    jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase,
      'case_narrative_id', v_narr, 'self_approved', v_self));
end;
$function$;
