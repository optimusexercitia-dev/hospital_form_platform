-- ---------------------------------------------------------------------------
-- Case Correction UX — the conclusion gate + corrector attribution.
--
-- Two doors are rewritten, both wholly (they are recreated from the LIVE catalog
-- definition, never from the older migration text — the migration files that first
-- created them are stale by design, CLAUDE.md graphify exception):
--
--  1. `close_case` — an OPEN correction request now BLOCKS conclusion (HC0T0).
--     Before this, a coordinator could conclude a case with a correction still
--     mid-flight: every correction door gates on `cases.status not in
--     ('completed','cancelled')` (HC020), so the request was not resolved by the
--     conclusion — it was STRANDED. The corrector could not resubmit, the approver
--     could not approve, and even `withdraw_correction` refused, leaving a row in an
--     open status against a frozen case forever. The only exit was `reopen_case`.
--     The two legitimate exits stay exactly what they were: resolve the request
--     (approve / reject-then-withdraw) or withdraw it.
--
--     Scope note: the guard covers PHASE **and** NARRATIVE requests. The stranding
--     above is a property of the request's status vs. the case's, not of which
--     target it points at, so gating only the phase arm would leave the identical
--     defect reachable through a narrative correction.
--
--  2. `list_my_cases` — a pending correction ATTRIBUTED to the caller now surfaces
--     on "Meus Casos", the way an unfilled assigned phase already does. Two changes,
--     both flag-gated on `case_corrections`:
--       - the case-visibility arm admits a case where the caller holds the corrector
--         slot on an open request (they may hold NO phase/narrative assignment and no
--         grant — `permitted_corrector` is validated at file time as a commission
--         member with case read, so this widens the list by nothing RLS withheld);
--       - a `kind: 'correction'` item is emitted per open request, carrying the
--         TARGET's title/position so it sorts beside the phase it corrects.
--
-- Neither door's authority, flag gating, or existing guards change.
-- ---------------------------------------------------------------------------

-- 1. close_case — + the open-correction gate (HC0T0) ------------------------
create or replace function public.close_case(p_case_id uuid)
returns public.cases
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_status text;
  v_outcome_id uuid;
  v_unsettled integer;
  v_offered integer;
  v_commission uuid;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select status, outcome_id into v_status, v_outcome_id
  from public.cases where id = p_case_id;
  if v_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  select count(*) into v_unsettled
  from public.case_phases
  where case_id = p_case_id and status in ('pending', 'active');
  if v_unsettled > 0 then
    raise exception 'conclua ou marque todas as fases antes de concluir o caso'
      using errcode = 'HC031';
  end if;

  select count(*) into v_offered
  from public.case_offered_outcomes where case_id = p_case_id;
  if v_offered > 0 and v_outcome_id is null then
    raise exception 'selecione um desfecho antes de concluir o caso'
      using errcode = 'HC028';
  end if;

  if app.feature_enabled('case_referrals') and exists (
    select 1 from public.case_referral r
    where r.source_case_id = p_case_id and r.response_expected = true
      and r.status in ('sent', 'received', 'accepted', 'in_review', 'awaiting_information', 'answered')
  ) then
    raise exception 'há encaminhamentos aguardando resposta; conclua, recuse ou retire antes de encerrar o caso'
      using errcode = 'HC076';
  end if;

  -- NEW — an OPEN correction request blocks conclusion. `rejected` counts as open:
  -- it is a RESTING state the corrector resumes from, not a resolution (the two
  -- terminal statuses are `approved` and `withdrawn`). Concluding over any of the
  -- five would strand the request behind every correction door's own HC020 gate.
  if app.feature_enabled('case_corrections') and exists (
    select 1 from public.case_correction_requests cr
    where cr.case_id = p_case_id
      and cr.status in ('requested', 'in_progress', 'resubmitted', 'under_review', 'rejected')
  ) then
    raise exception 'há solicitações de correção pendentes; aprove-as ou retire-as antes de concluir o caso'
      using errcode = 'HC0T0';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  update public.cases
  set status = 'completed', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;
  if v_result.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  update public.case_phases
  set status = 'not_required', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pending', 'active');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$function$;

comment on function public.close_case(uuid) is
  'Conclui um caso aberto. Bloqueia com HC0T0 enquanto houver solicitação de correção em aberto (requested/in_progress/resubmitted/under_review/rejected).';

-- 2. list_my_cases — + the corrector-attribution arm -----------------------
create or replace function public.list_my_cases(p_commission uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  -- Resolved ONCE: the flag gates both the visibility arm and the item arm, and
  -- they must not be able to disagree within a single call.
  v_corrections_on boolean;
  v_result jsonb;
begin
  -- assert_case_access_enabled() removed (B4 — flag retired).
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  if not app.is_active(v_uid) then
    return '[]'::jsonb;
  end if;

  v_corrections_on := app.feature_enabled('case_corrections');

  select coalesce(jsonb_agg(row_obj order by created_at desc, case_number desc), '[]'::jsonb)
    into v_result
  from (
    select
      c.id,
      c.created_at,
      c.case_number,
      jsonb_build_object(
        'case_id', c.id,
        'case_number', c.case_number,
        'label', c.label,
        'status', c.status,
        'my_role',
          case
            when app.is_staff_admin_of_for(c.commission_id, v_uid) then 'coordinator'
            when exists (
              select 1 from public.case_access_grants g
              where g.case_id = c.id and g.principal_id = v_uid and g.write_case_content
                and g.revoked_at is null
                and (g.expires_at is null or g.expires_at > now())
            ) then 'collaborator'
            else 'viewer'
          end,
        'items', (
          -- `sort_rank` keeps a correction directly BENEATH the phase/narrative it
          -- corrects: both carry the target's display_position, so without the
          -- tiebreak their order would be arbitrary between calls.
          select coalesce(jsonb_agg(item order by display_position, sort_rank), '[]'::jsonb)
          from (
            select
              coalesce(cp.display_position, cp.position) as display_position,
              0 as sort_rank,
              jsonb_build_object(
                'kind', 'phase',
                'id', cp.id,
                'title', coalesce(nullif(btrim(cp.title), ''), f.title, 'Fase ' || cp.position),
                'status', cp.status,
                'display_position', coalesce(cp.display_position, cp.position),
                'actionable', (cp.status = 'active')
              ) as item
            from public.case_phases cp
            join public.forms f on f.id = cp.form_id
            where cp.case_id = c.id and cp.assigned_to = v_uid
            union all
            select
              cn.display_position,
              0 as sort_rank,
              jsonb_build_object(
                'kind', 'narrative',
                'id', cn.id,
                'title', cn.type_label,
                'status', cn.status,
                'display_position', cn.display_position,
                'actionable', (cn.status = 'open')
              ) as item
            from public.case_narratives cn
            where cn.case_id = c.id and cn.assigned_to = v_uid
            union all
            -- NEW — corrections where the caller holds the corrector slot. The item
            -- is keyed on the REQUEST id and carries its TARGET's title/position, so
            -- the card reads "a correction of Fase 3", not a bare request id.
            --
            -- `actionable` mirrors the TS `canContinueCorrection` exactly: a `void`
            -- request has no draft to open, and `resubmitted`/`under_review` are
            -- waiting on the APPROVER, not on the corrector. The other three are the
            -- corrector's to act on (requested → create the draft; in_progress /
            -- rejected → resume it).
            select
              coalesce(cp.display_position, cp.position, cn.display_position) as display_position,
              1 as sort_rank,
              jsonb_build_object(
                'kind', 'correction',
                'id', cr.id,
                'title', coalesce(
                  nullif(btrim(cp.title), ''), f.title,
                  'Fase ' || cp.position, cn.type_label, 'Correção'),
                'status', cr.status,
                'display_position', coalesce(cp.display_position, cp.position, cn.display_position),
                'actionable', (
                  cr.kind <> 'void'
                  and cr.status in ('requested', 'in_progress', 'rejected')
                ),
                'correction_kind', cr.kind,
                'case_phase_id', cr.case_phase_id,
                'case_narrative_id', cr.case_narrative_id
              ) as item
            from public.case_correction_requests cr
            left join public.case_phases cp on cp.id = cr.case_phase_id
            left join public.forms f on f.id = cp.form_id
            left join public.case_narratives cn on cn.id = cr.case_narrative_id
            where v_corrections_on
              and cr.case_id = c.id
              and cr.permitted_corrector = v_uid
              and cr.status in ('requested', 'in_progress', 'resubmitted',
                                'under_review', 'rejected')
          ) items
        )
      ) as row_obj
    from public.cases c
    where c.commission_id = p_commission
      and (
        exists (select 1 from public.case_access_grants g
                where g.case_id = c.id and g.principal_id = v_uid
                  and g.revoked_at is null
                  and (g.expires_at is null or g.expires_at > now()))
        or exists (select 1 from public.case_phases cp
                   where cp.case_id = c.id and cp.assigned_to = v_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = c.id and cn.assigned_to = v_uid)
        -- NEW — the corrector slot alone makes a case "mine". A corrector need hold
        -- no assignment and no grant, so without this arm the case carrying their
        -- pending correction would not appear on Meus Casos at all. Not a widening
        -- of what they may READ: file_correction_request validates the corrector as
        -- a commission member with `app.can_read_case` before the slot is ever set.
        or (v_corrections_on and exists (
              select 1 from public.case_correction_requests cr
              where cr.case_id = c.id and cr.permitted_corrector = v_uid
                and cr.status in ('requested', 'in_progress', 'resubmitted',
                                  'under_review', 'rejected')))
      )
      and not app.is_case_respondent(c.id, v_uid)
      and not app.is_recused_from_case(c.id, v_uid)
  ) rows;

  return v_result;
end;
$function$;

comment on function public.list_my_cases(uuid) is
  'Meus Casos: cada caso que o chamador acessa (atribuído, concedido, ou como corretor de uma correção em aberto), com seus itens atribuídos — fase, narrativa e correção.';
