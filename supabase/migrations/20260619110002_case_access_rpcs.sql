-- Case Access Control (3 of 3 / BE-4): the RPC surface + the get_case_detail
-- re-gate + the content-write broadening. ADR 0033.
--
-- All NEW public functions gate the case_access flag (app.assert_case_access_enabled)
-- and are re-revoked from anon/public at the foot. The grants + narrative-lifecycle
-- RPCs are SECURITY DEFINER (they bypass RLS to do the authority checks + the
-- writes the base policies deny to non-staff_admins). list_my_cases is DEFINER
-- (self-scoped). get_case_detail is CREATE OR REPLACE'd on its 20260619100002 final
-- body — the gate broadens is_staff_admin_of -> can_read_case, +viewer_capabilities,
-- +per-narrative assigned_to/status, +case.opened audit on non-coordinator open;
-- THE SUBMITTED-ONLY ANSWER SUBQUERY IS PRESERVED VERBATIM (the Phase-7 invariant).
--
-- The content-write broadening (action items / documents / events / tags) swaps the
-- is_staff_admin_of authz arm for app.can_write_case_content where the plan calls
-- for it; lifecycle + vocabulary CRUD stay coordinator-only.
--
-- SQLSTATEs: HC020 (case terminal), HC021 (target not a member), HC054 (terminal
-- narrative freeze — reused), HC055 (narrative wrong lifecycle state — new in 110000),
-- 42501 (narrative-write predicate denial).

-- ===========================================================================
-- grant_case_access(case, user, level) -> void   (coordinator-only; upsert)
-- ===========================================================================
-- DEFINER: re-checks staff_admin/admin of the case's commission (the base
-- case_access table has NO write policy), requires the target to be a CURRENT
-- member of that commission (HC021), and upserts the grant. 'write' implies 'read'
-- (the predicates treat any row as read). A self-grant is harmless (a coordinator
-- already passes the predicates) but allowed for uniformity.
create function public.grant_case_access(
  p_case uuid,
  p_user uuid,
  p_level text
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_level not in ('read', 'write') then
    raise exception 'nível de acesso inválido' using errcode = 'check_violation';
  end if;
  -- The grantee must be a current member of the case's commission (HC021).
  if not app.is_member_of_for(v_commission, p_user) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  insert into public.case_access (case_id, user_id, level, granted_by, granted_at)
  values (p_case, p_user, p_level, auth.uid(), now())
  on conflict (case_id, user_id)
  do update set level = excluded.level, granted_by = excluded.granted_by,
                granted_at = excluded.granted_at;
end;
$$;

grant execute on function public.grant_case_access(uuid, uuid, text) to authenticated, service_role;

-- ===========================================================================
-- revoke_case_access(case, user) -> void   (coordinator-only)
-- ===========================================================================
-- Deletes the EXPLICIT grant. Does NOT remove attribution-derived read — an
-- assignee of a phase/narrative still reads the full case (ADR 0033 D6); unassign
-- them to remove that. Idempotent (a no-op delete is fine).
create function public.revoke_case_access(
  p_case uuid,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.case_access where case_id = p_case and user_id = p_user;
end;
$$;

grant execute on function public.revoke_case_access(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- assign_narrative(narrative, assignee) -> void   (coordinator-only)
-- ===========================================================================
-- Sets case_narratives.assigned_to (the assignee then fills + concludes; their
-- attribution auto-grants full-case read via can_read_case). Coordinator-only;
-- case non-terminal (HC020); narrative 'aberta' (HC055); assignee a current member
-- (HC021). Writes under app.in_narrative_rpc so guard_case_narrative_frozen permits
-- it (the guard otherwise blocks any non-terminal-but-flag-off write path is N/A
-- here — the case is non-terminal — but the window keeps parity with the body save).
create function public.assign_narrative(
  p_narrative uuid,
  p_assignee uuid
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status, cn.status
    into v_case_id, v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;
  if not app.is_member_of_for(v_commission, p_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = p_assignee, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

grant execute on function public.assign_narrative(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- unassign_narrative(narrative) -> void   (coordinator-only)
-- ===========================================================================
-- Clears assigned_to. Removes that member's attribution-derived read (unless they
-- hold a separate grant) and reopens the narrative to write-grantees (Q14). Allowed
-- while the narrative is aberta or concluida (a coordinator may detach either);
-- case non-terminal (HC020).
create function public.unassign_narrative(p_narrative uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status
    into v_case_id, v_commission, v_case_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

grant execute on function public.unassign_narrative(uuid) to authenticated, service_role;

-- ===========================================================================
-- save_narrative_body(narrative, body_md) -> void   (Q14-broadened auth)
-- ===========================================================================
-- The Case Access Control GENERALIZATION of update_case_narrative_body: the AUTHZ
-- broadens from staff_admin/admin to app.can_write_case_narrative (coordinator/admin
-- OR the assignee OR a content write-grantee on an UN-assigned narrative — Q14), so
-- a focused-editor assignee or an un-attributed-narrative write-grantee may save.
-- DEFINER (bypasses the base staff_admin-only write policy; re-checks the predicate
-- explicitly). Narrative must be 'aberta' (concluded -> reopen first; HC055) and the
-- case non-terminal (HC054 — reuses the existing freeze message/code). update_case_
-- narrative_body is KEPT as the coordinator inline path (lead sub-decision 1).
create function public.save_narrative_body(
  p_narrative uuid,
  p_body_md text
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select c.status, cn.status into v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- Q14 write predicate (the authority).
  if not app.can_write_case_narrative(p_narrative, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'as narrativas deste caso estão bloqueadas' using errcode = 'HC054';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set body_md = p_body_md, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

grant execute on function public.save_narrative_body(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- conclude_narrative(narrative) -> void   (assignee or coordinator)
-- ===========================================================================
-- aberta -> concluida (freezes the body via the status; the body-save RPCs reject a
-- non-aberta write). The ASSIGNEE or a coordinator may conclude. Stamps
-- concluded_at/by. case non-terminal (HC020); narrative aberta (HC055).
create function public.conclude_narrative(p_narrative uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
  v_case_status text;
  v_status text;
  v_assigned uuid;
begin
  perform app.assert_case_access_enabled();

  select c.commission_id, c.status, cn.status, cn.assigned_to
    into v_commission, v_case_status, v_status, v_assigned
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- The assignee OR a coordinator/admin may conclude.
  if not (v_assigned = auth.uid()
          or app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'concluida', concluded_at = now(), concluded_by = auth.uid(),
      updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

grant execute on function public.conclude_narrative(uuid) to authenticated, service_role;

-- ===========================================================================
-- reopen_narrative(narrative) -> void   (coordinator-only)
-- ===========================================================================
-- concluida -> aberta (so the assignee can edit again). Coordinator-only; case
-- non-terminal (HC020); narrative concluida (HC055). Clears concluded_*.
create function public.reopen_narrative(p_narrative uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select c.commission_id, c.status, cn.status
    into v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'concluida' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'aberta', concluded_at = null, concluded_by = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

grant execute on function public.reopen_narrative(uuid) to authenticated, service_role;

-- ===========================================================================
-- list_my_cases(p_commission) -> jsonb   (DEFINER; self-scoped "Meus Casos")
-- ===========================================================================
-- Every case in p_commission where auth.uid() is a phase/narrative ASSIGNEE or has
-- a case_access GRANT. One row per case with the caller's attributed items inline.
-- DEFINER + self-scoped to auth.uid(): never leaks a case the caller cannot access.
-- STATUS ONLY (no answers — the Phase-7 invariant). Gated by case_access.
--   my_role: coordinator (staff_admin/admin) | collaborator (write grant) | viewer.
--   items[].actionable: a phase 'ativa' assigned to me | a narrative 'aberta'
--     assigned to me.
-- Ordered newest-case-first (created_at desc, then case_number desc).
create function public.list_my_cases(p_commission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform app.assert_case_access_enabled();

  if v_uid is null then
    return '[]'::jsonb;
  end if;

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
            when app.is_staff_admin_of_for(c.commission_id, v_uid)
                 or app.is_admin_for(v_uid) then 'coordinator'
            when exists (
              select 1 from public.case_access ca
              where ca.case_id = c.id and ca.user_id = v_uid and ca.level = 'write'
            ) then 'collaborator'
            else 'viewer'
          end,
        'items', (
          select coalesce(jsonb_agg(item order by display_position), '[]'::jsonb)
          from (
            -- the caller's PHASES of this case
            select
              coalesce(cp.display_position, cp.position) as display_position,
              jsonb_build_object(
                'kind', 'phase',
                'id', cp.id,
                'title', coalesce(nullif(btrim(cp.title), ''), f.title, 'Fase ' || cp.position),
                'status', cp.status,
                'display_position', coalesce(cp.display_position, cp.position),
                'actionable', (cp.status = 'ativa')
              ) as item
            from public.case_phases cp
            join public.forms f on f.id = cp.form_id
            where cp.case_id = c.id and cp.assigned_to = v_uid
            union all
            -- the caller's NARRATIVES of this case
            select
              cn.display_position,
              jsonb_build_object(
                'kind', 'narrative',
                'id', cn.id,
                'title', cn.type_label,
                'status', cn.status,
                'display_position', cn.display_position,
                'actionable', (cn.status = 'aberta')
              ) as item
            from public.case_narratives cn
            where cn.case_id = c.id and cn.assigned_to = v_uid
          ) items
        )
      ) as row_obj
    from public.cases c
    where c.commission_id = p_commission
      -- "Meus Casos" is the caller's PERSONAL list: cases they are attributed to
      -- (phase/narrative assignee) OR granted (ADR 0033 D7). A coordinator/admin is
      -- NOT auto-included for every case (the board is their management surface) —
      -- they appear here only when personally attributed/granted, and then carry the
      -- 'coordinator' role chip.
      and (
        exists (select 1 from public.case_access ca
                where ca.case_id = c.id and ca.user_id = v_uid)
        or exists (select 1 from public.case_phases cp
                   where cp.case_id = c.id and cp.assigned_to = v_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = c.id and cn.assigned_to = v_uid)
      )
  ) rows;

  return v_result;
end;
$$;

grant execute on function public.list_my_cases(uuid) to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function created above.
-- ===========================================================================
revoke execute on function public.grant_case_access(uuid, uuid, text) from anon, public;
revoke execute on function public.revoke_case_access(uuid, uuid) from anon, public;
revoke execute on function public.assign_narrative(uuid, uuid) from anon, public;
revoke execute on function public.unassign_narrative(uuid) from anon, public;
revoke execute on function public.save_narrative_body(uuid, text) from anon, public;
revoke execute on function public.conclude_narrative(uuid) from anon, public;
revoke execute on function public.reopen_narrative(uuid) from anon, public;
revoke execute on function public.list_my_cases(uuid) from anon, public;

-- ===========================================================================
-- get_case_detail(case) — REPLACE: re-gate to can_read_case (+ viewer caps +
-- per-narrative assignee/status + case.opened audit). Submitted-only PRESERVED.
-- ===========================================================================
-- Identical to the 20260619100002 final body EXCEPT:
--   (1) GATE: is_staff_admin_of(commission) -> app.can_read_case(case, auth.uid())
--       (a read-grantee / phase- or narrative-assignee may now open the case in
--       full). Unknown/unreadable -> no_data_found, same as before (no leak).
--   (2) +'viewer_capabilities' top-level object { can_read, can_write_content,
--       can_manage_lifecycle } for auth.uid() — folded in so the detail page needs
--       no extra round-trip (same shape as public.case_viewer_capabilities).
--   (3) each narrative object gains assigned_to, assignee_name, status,
--       concluded_at, concluded_by (ADR 0033 D5).
--   (4) AUDIT: emit a 'case.opened' access row (Rule 11) when the caller is NOT a
--       coordinator of the case's commission (mirrors response.opened_foreign /
--       event_patient.read). app.audit_write no-ops while audit_trail is OFF and
--       attributes auth.uid(); the case.opened allow-list entry lands in …110003.
--       The cache() wrapper on getCaseDetail collapses multi-component reads in one
--       request to a single RPC call, so one page-open = one case.opened row.
-- ⚠️ THE SUBMITTED-ONLY ANSWER LATERAL SUBQUERY IS COPIED VERBATIM — response_id /
--    submitted_at stay non-null ONLY for a SUBMITTED response of a 'concluida'
--    phase. The Phase-7 in_progress-answers invariant is structurally untouched.
-- VOLATILE, not STABLE (CA-001): this RPC now has a WRITE side-effect — it INSERTs
-- the case.opened audit row via log_audit_access on a non-coordinator open. A STABLE
-- function runs in a read-only transaction, so PostgREST would raise 25006 "cannot
-- execute INSERT in a read-only transaction" → null → notFound() for every
-- non-coordinator. Same reason the event_patient.read audited-read path is volatile.
create or replace function public.get_case_detail(p_case_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Re-gate: a coordinator OR a read-grantee OR a phase/narrative assignee (ADR
  -- 0033). With the case_access flag OFF, app.can_read_case falls back to
  -- is_member_of — BUT this DEFINER read was is_staff_admin_of-gated before, so to
  -- preserve "flag OFF ⇒ today's behavior" EXACTLY we keep the coordinator gate as
  -- the floor when the feature is dark, and broaden only when it is ON.
  if app.feature_enabled('case_access') then
    if not app.can_read_case(p_case_id, auth.uid()) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  else
    if not app.is_staff_admin_of(v_case.commission_id) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_admin();

  -- AUDIT (Rule 11): a non-coordinator opening a full case detail. Mirrors
  -- response.opened_foreign — records THAT + WHO, never any body/PHI. Only emitted
  -- when the feature is on (the broadened-read scenario this audits cannot occur
  -- with the flag OFF). No-ops while audit_trail is OFF.
  if app.feature_enabled('case_access') and not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

  -- The assigned outcome, resolved LIVE (or null).
  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    -- The viewer's capability descriptor (ADR 0033 D7), for auth.uid().
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,  -- we only reach here if the caller may read
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
    -- The FROZEN offered set (case_offered_outcomes), resolved to label/flags.
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'concluida'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    -- The case's NARRATIVES (ADR 0032 + 0033 attribution/lifecycle), ordered by
    -- display_position. body_md IS returned (coordinator/grantee read path); only
    -- the audit log excludes it. assigned_to/status/concluded_* are the ADR-0033
    -- additions.
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_case_detail(uuid) to authenticated, service_role;
revoke execute on function public.get_case_detail(uuid) from anon, public;

-- ===========================================================================
-- CONTENT-WRITE BROADENING — action items + tags: staff_admin -> can_write_case_content
-- ===========================================================================
-- ADR 0033 D4 / plan §2.3: a case-WRITE grantee may manage non-identity-bound case
-- content. case_documents / case_events are direct-table writes already broadened
-- by additive RLS policies (…110001). The action-item + tag-assignment RPCs are
-- security INVOKER and rely on the staff_admin-only base WRITE RLS, so broadening
-- only their internal authz check would NOT help a write-grantee (the table write
-- would still be RLS-denied). Per the approved plan ("staff writes flow through the
-- DEFINER RPCs which re-check can_write_case_content"), CREATE OR REPLACE them as
-- SECURITY DEFINER with app.can_write_case_content as the authority — exactly the
-- shape of the existing app.advance_action_item_core. Bodies are otherwise VERBATIM
-- (same validation, same HC021 member check, same commission-honesty guards via the
-- HC026 trigger on tag assignment). LIFECYCLE + VOCABULARY CRUD stay coordinator-only.
--
-- The broadening is FLAG-AWARE the simple way: with case_access OFF there are no
-- 'write' grants, so can_write_case_content reduces to staff_admin/admin — today's
-- behavior — and these RPCs still gate cases_extras at entry (unchanged).

-- create_action_item — now DEFINER; authority = can_write_case_content.
create or replace function public.create_action_item(
  p_case_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null,
  p_source_case_phase_id uuid default null
)
returns public.case_action_items
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_action_items;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Authority broadened (ADR 0033 D4): coordinator/admin OR a case-write grantee.
  if not app.can_write_case_content(p_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  if p_source_case_phase_id is not null and not exists (
    select 1 from public.case_phases where id = p_source_case_phase_id and case_id = p_case_id
  ) then
    raise exception 'a fase de origem não pertence a este caso' using errcode = 'check_violation';
  end if;

  insert into public.case_action_items
    (case_id, source_case_phase_id, title, description, assigned_to, due_date, created_by)
  values
    (p_case_id, p_source_case_phase_id, btrim(p_title), nullif(btrim(p_description), ''),
     p_assigned_to, p_due_date, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_action_item(uuid, text, text, uuid, date, uuid)
  to authenticated, service_role;
revoke all on function public.create_action_item(uuid, text, text, uuid, date, uuid)
  from public, anon;

-- update_action_item — now DEFINER; authority = can_write_case_content.
create or replace function public.update_action_item(
  p_action_item_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null
)
returns public.case_action_items
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_result public.case_action_items;
begin
  perform app.assert_extras_enabled();

  select case_id into v_case_id from public.case_action_items where id = p_action_item_id;
  if v_case_id is null then
    raise exception 'item % não encontrado', p_action_item_id using errcode = 'no_data_found';
  end if;
  v_commission_id := app.commission_of_case(v_case_id);
  if not app.can_write_case_content(v_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  update public.case_action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      updated_at = now()
  where id = p_action_item_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_action_item(uuid, text, text, uuid, date)
  to authenticated, service_role;
revoke all on function public.update_action_item(uuid, text, text, uuid, date)
  from public, anon;

-- advance_action_item_core — broaden the staff_admin arm to ALSO admit a case-write
-- grantee (the assignee arm is unchanged → a plain assignee still advances; HC027).
create or replace function app.advance_action_item_core(
  p_action_item_id uuid,
  p_status text
)
returns public.case_action_items
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_assigned_to uuid;
  v_uid uuid := auth.uid();
  v_result public.case_action_items;
begin
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'estado de item inválido' using errcode = 'check_violation';
  end if;

  select case_id, assigned_to into v_case_id, v_assigned_to
  from public.case_action_items where id = p_action_item_id;
  if v_case_id is null then
    raise exception 'item % não encontrado', p_action_item_id using errcode = 'no_data_found';
  end if;

  -- Authority: the assignee, OR a content-writer of the case (coordinator/admin or
  -- a case-write grantee — ADR 0033 D4). HC027 otherwise.
  if not (
    (v_assigned_to is not null and v_assigned_to = v_uid)
    or app.can_write_case_content(v_case_id, v_uid)
  ) then
    raise exception 'você não pode alterar este item de ação' using errcode = 'HC027';
  end if;

  update public.case_action_items
  set status = p_status,
      completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'done' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_item_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function app.advance_action_item_core(uuid, text) from public;
grant execute on function app.advance_action_item_core(uuid, text) to authenticated, service_role;

-- assign_case_tag — now DEFINER; authority = can_write_case_content (the HC026
-- same-commission BEFORE-INSERT guard still fires).
create or replace function public.assign_case_tag(p_case_id uuid, p_tag_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not app.can_write_case_content(p_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  insert into public.case_tag_assignments (case_id, tag_id, assigned_by)
  values (p_case_id, p_tag_id, auth.uid())
  on conflict (case_id, tag_id) do nothing;
end;
$$;

grant execute on function public.assign_case_tag(uuid, uuid) to authenticated, service_role;
revoke all on function public.assign_case_tag(uuid, uuid) from public, anon;

-- unassign_case_tag — now DEFINER; authority = can_write_case_content.
create or replace function public.unassign_case_tag(p_case_id uuid, p_tag_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not app.can_write_case_content(p_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.case_tag_assignments
  where case_id = p_case_id and tag_id = p_tag_id;
end;
$$;

grant execute on function public.unassign_case_tag(uuid, uuid) to authenticated, service_role;
revoke all on function public.unassign_case_tag(uuid, uuid) from public, anon;
