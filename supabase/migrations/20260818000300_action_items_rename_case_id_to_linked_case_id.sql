-- Rename public.action_items.case_id -> public.action_items.linked_case_id
--
-- RATIONALE (association vs. provenance).
-- The action_items hub carries TWO distinct case pointers whose names collided
-- confusingly:
--   * source_case_id  — the PROVENANCE pointer: the case a `source_type='case'`
--                       item was minted from. ON DELETE CASCADE (the item cannot
--                       outlive its origin case). UNTOUCHED by this migration.
--   * case_id         — the OPTIONAL meeting/manual -> case cross-link
--                       (ASSOCIATION only). ON DELETE SET NULL (the association
--                       simply clears if the case is removed).
-- The old name `case_id` read as if it were the primary case pointer and was
-- easily confused with source_case_id. Renaming the association column to
-- `linked_case_id` makes the association-vs-provenance distinction explicit.
--
-- SCOPE — surgical. ONLY public.action_items.case_id is renamed. Every other
-- table's own case_id (referrals, case_phases, patient_participants, case_notes,
-- interview_sessions, ...), all `p_case_id` RPC parameters, and source_case_id
-- are deliberately left untouched.
--
-- FUNCTION BODIES. Postgres does NOT rewrite plpgsql/SQL function bodies when a
-- column is renamed, so every function that names the column by hand must be
-- re-emitted or it breaks at runtime. Bodies below are copied from the LIVE
-- `pg_get_functiondef` output (NOT stale migration text — ADR 0078 / the
-- re-emit-from-live-def rule) with ONLY the action_items.case_id reference
-- changed to linked_case_id; everything else (signature, SECURITY DEFINER,
-- search_path, comments) is byte-identical.
--
-- Six functions reference the COLUMN and are re-emitted:
--   app.can_read_action_item      (RLS predicate — SELECT list from action_items)
--   app.case_of_action_item       (coalesce(source_case_id, case_id))
--   app.trg_audit_action_items    (tracked-column allow-list string literal)
--   app.guard_action_item         (new.case_id cross-link same-commission guard)
--   public.create_committee_action_item  (INSERT column list; p_case_id param KEPT)
--   public.delete_committee_action_item  (SELECT list from action_items)
-- NOTE: app.guard_action_item names the column only via new.case_id and never
-- the literal `action_items`, so a `def ~ 'action_items' AND ~ 'case_id'` sweep
-- misses it; it was found by enumerating triggers on the table.
--
-- NOT changed (verified against the live catalog):
--   public.get_member_overview  — its case_id tokens are OTHER tables (cp/cn/g).
--   public.list_my_action_items — 'case_id' there is a JSONB OUTPUT KEY (the RPC
--                                 contract consumed by src/lib/queries), not the
--                                 column; renaming it would break the TS mapper.
-- The CHECK constraint action_items_case_link_check and the RLS policies
-- action_items_select / action_items_staff_admin_write reference the column via
-- parsed node trees and AUTO-FOLLOW the rename (no manual re-creation needed).

begin;

-- 1. Column rename.
alter table public.action_items rename column case_id to linked_case_id;

-- 2. Rename the FK constraint (preserves ON DELETE SET NULL) and its index so the
--    catalog names track the column. The reference target (cases) is unchanged.
alter table public.action_items rename constraint action_items_case_fkey to action_items_linked_case_fkey;
alter index public.action_items_case_idx rename to action_items_linked_case_idx;

-- 3. Re-emit the six functions that name the column (live bodies; single token changed).

CREATE OR REPLACE FUNCTION app.can_read_action_item(p_action_item_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
  v_scope text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_assigned_to uuid;
  v_anchor_case uuid;
begin
  if not app.is_active(p_uid) then                    -- A24·5 outer gate (K28 pin)
    return false;
  end if;

  select commission_id, visibility_scope, source_case_id, linked_case_id, assigned_to
    into v_commission_id, v_scope, v_source_case_id, v_case_id, v_assigned_to
  from public.action_items where id = p_action_item_id;
  if v_commission_id is null then
    return false;
  end if;

  v_anchor_case := coalesce(v_source_case_id, v_case_id);
  if v_anchor_case is not null and app.is_case_excluded(v_anchor_case, p_uid) then   -- K27 pin
    return false;
  end if;

  if v_scope = 'committee' then
    return app.is_member_of_for(v_commission_id, p_uid);                 -- C7: org arm removed (A11)

  elsif v_scope = 'case_restricted' then
    return app.can_read_case(v_anchor_case, p_uid);                      -- unchanged (K19: follows can_read_case)

  elsif v_scope = 'assignees_only' then
    return app.is_staff_admin_of_for(v_commission_id, p_uid)             -- C7: org arm removed (A11)
        or (v_assigned_to is not null and v_assigned_to = p_uid)
        or exists (
          select 1 from public.action_item_assignments a
          where a.action_item_id = p_action_item_id
            and a.user_id = p_uid
            and a.completed_at is null
        );
  end if;

  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION app.case_of_action_item(p_action_item_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
  select coalesce(ai.source_case_id, ai.linked_case_id)
  from public.action_items ai where ai.id = p_action_item_id;
$function$;

CREATE OR REPLACE FUNCTION app.trg_audit_action_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_cols constant text[] := array[
    'source_type', 'status_id', 'urgency_id', 'due_date', 'assigned_to', 'linked_case_id',
    'source_case_id', 'source_case_phase_id', 'visibility_scope'
  ];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('action_item.created', 'action_item', new.id, new.commission_id,
      'Item de ação criado', app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('action_item.updated', 'action_item', new.id, new.commission_id,
      'Item de ação atualizado', app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
    return null;
  else
    perform app.audit_write('action_item.deleted', 'action_item', old.id, old.commission_id,
      'Item de ação removido', app.audit_diff(to_jsonb(old), null, v_cols));
    return null;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION app.guard_action_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_meeting_commission uuid;
  v_case_commission uuid;
  v_source_case_commission uuid;
  v_status_commission uuid;
  v_urgency_commission uuid;
begin
  -- Meeting-sourced rows: the meeting (and agenda item) must belong to
  -- commission_id (the CHECK already forced source_meeting_id present).
  if new.source_type = 'meeting' then
    select commission_id into v_meeting_commission
    from public.meetings where id = new.source_meeting_id;
    if v_meeting_commission is null then
      raise exception 'reunião não encontrada' using errcode = 'no_data_found';
    end if;
    if new.commission_id <> v_meeting_commission then
      raise exception 'a comissão do item de ação não corresponde à reunião'
        using errcode = 'check_violation';
    end if;
    if new.source_agenda_item_id is not null and not exists (
      select 1 from public.meeting_agenda_items
      where id = new.source_agenda_item_id and meeting_id = new.source_meeting_id
    ) then
      raise exception 'o item de pauta de origem não pertence a esta reunião'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Case-sourced rows: the source case must be same-commission (HC032), and the
  -- source phase (if any) must belong to that case. Then FORCE case_restricted.
  if new.source_type = 'case' then
    select commission_id into v_source_case_commission
    from public.cases where id = new.source_case_id;
    if v_source_case_commission is null then
      raise exception 'caso de origem não encontrado' using errcode = 'no_data_found';
    end if;
    if v_source_case_commission is distinct from new.commission_id then
      raise exception 'este caso pertence a outra comissão' using errcode = 'HC032';
    end if;
    if new.source_case_phase_id is not null and not exists (
      select 1 from public.case_phases
      where id = new.source_case_phase_id and case_id = new.source_case_id
    ) then
      raise exception 'a fase de origem não pertence a este caso'
        using errcode = 'check_violation';
    end if;
    -- Hard-force: a case item is ALWAYS case_restricted, on INSERT and UPDATE.
    new.visibility_scope := 'case_restricted';
  end if;

  -- An optional case cross-link (meeting/manual rows) must be same-commission.
  if new.linked_case_id is not null then
    select commission_id into v_case_commission
    from public.cases where id = new.linked_case_id;
    if v_case_commission is distinct from new.commission_id then
      raise exception 'este caso pertence a outra comissão' using errcode = 'HC032';
    end if;
  end if;

  -- The status must be global OR belong to this commission.
  select commission_id into v_status_commission
  from public.action_item_statuses where id = new.status_id;
  if v_status_commission is not null and v_status_commission <> new.commission_id then
    raise exception 'este estado pertence a outra comissão' using errcode = 'check_violation';
  end if;

  -- The urgency (if set) must be global OR belong to this commission.
  if new.urgency_id is not null then
    select commission_id into v_urgency_commission
    from public.action_item_urgency_levels where id = new.urgency_id;
    if v_urgency_commission is not null and v_urgency_commission <> new.commission_id then
      raise exception 'esta urgência pertence a outra comissão' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_committee_action_item(p_commission uuid, p_source_type text, p_meeting_id uuid DEFAULT NULL::uuid, p_agenda_item_id uuid DEFAULT NULL::uuid, p_case_id uuid DEFAULT NULL::uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_assigned_to uuid DEFAULT NULL::uuid, p_urgency_id uuid DEFAULT NULL::uuid, p_due_date date DEFAULT NULL::date, p_source_case_phase_id uuid DEFAULT NULL::uuid, p_visibility_scope text DEFAULT NULL::text)
 RETURNS action_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_status_id uuid;
  v_scope text;
  v_result public.action_items;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  if p_source_type not in ('meeting', 'manual', 'case') then
    raise exception 'origem de item inválida' using errcode = 'check_violation';
  end if;

  -- Authority + case-source flag gate.
  if p_source_type = 'case' then
    perform app.assert_extras_enabled();  -- the case arm is gated by cases_extras (Q8)
    if p_case_id is null then
      raise exception 'informe o caso de origem' using errcode = 'check_violation';
    end if;
    -- Case create authority: content-writer of the case (ADR 0033 D4). The
    -- source case is validated same-commission by guard_action_item (HC032).
    if not app.can_write_case_content(p_case_id, v_uid) then
      raise exception 'você não pode criar itens de ação neste caso' using errcode = '42501';
    end if;
  else
    if not (app.is_staff_admin_of(p_commission)) then
      raise exception 'você não pode criar itens de ação nesta comissão' using errcode = '42501';
    end if;
    if p_source_type = 'meeting' and p_meeting_id is null then
      raise exception 'informe a reunião de origem' using errcode = 'check_violation';
    end if;
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(p_commission, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  -- Resolve visibility_scope. For a case source the guard trigger hard-forces
  -- 'case_restricted' regardless, so we do not fight it here. For meeting/manual:
  -- an explicit value is validated; the default is 'case_restricted' when a case
  -- cross-link (p_case_id) is present, else 'committee'.
  if p_source_type = 'case' then
    v_scope := 'case_restricted';
  elsif p_visibility_scope is not null then
    if p_visibility_scope not in ('committee', 'case_restricted', 'assignees_only') then
      raise exception 'visibilidade inválida' using errcode = 'check_violation';
    end if;
    v_scope := p_visibility_scope;
  elsif p_case_id is not null then
    v_scope := 'case_restricted';
  else
    v_scope := 'committee';
  end if;

  v_status_id := app.action_item_initial_status(p_commission);
  if v_status_id is null then
    raise exception 'nenhum estado inicial configurado' using errcode = 'no_data_found';
  end if;

  -- Same-commission integrity (meeting/agenda/case/source-case/status/urgency) is
  -- enforced by guard_action_item (HC032 / check_violation) on the INSERT below.
  insert into public.action_items
    (commission_id, source_type, source_meeting_id, source_agenda_item_id, linked_case_id,
     source_case_id, source_case_phase_id, visibility_scope,
     title, description, status_id, urgency_id, due_date, assigned_to, created_by)
  values
    (p_commission, p_source_type,
     case when p_source_type = 'meeting' then p_meeting_id else null end,
     case when p_source_type = 'meeting' then p_agenda_item_id else null end,
     case when p_source_type = 'case' then null else p_case_id end,
     case when p_source_type = 'case' then p_case_id else null end,
     case when p_source_type = 'case' then p_source_case_phase_id else null end,
     v_scope,
     btrim(p_title), nullif(btrim(p_description), ''),
     v_status_id, p_urgency_id, p_due_date, p_assigned_to, v_uid)
  returning * into v_result;

  -- Mirror assigned_to as the single active `owner` assignment.
  if p_assigned_to is not null then
    insert into public.action_item_assignments (action_item_id, user_id, role, assigned_by)
    values (v_result.id, p_assigned_to, 'owner', v_uid);
  end if;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_committee_action_item(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
  v_source_type text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_anchor_case uuid;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id, source_type, source_case_id, linked_case_id
    into v_commission_id, v_source_type, v_source_case_id, v_case_id
  from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  -- Delete authority is staff_admin/org_admin for ALL sources (Q6). A case row's
  -- delete is additionally gated by cases_extras (Q8).
  if v_source_type = 'case' then
    perform app.assert_extras_enabled();
  end if;
  if not (app.is_staff_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2, §2b): case-anchored items only. A recused/respondent
  -- coordinator cannot delete an action item belonging to the case she is excluded
  -- from. Non-case-anchored (committee/manual) items are unaffected — the §7.7 twin.
  v_anchor_case := coalesce(v_source_case_id, v_case_id);
  if v_anchor_case is not null then
    perform app.assert_not_case_excluded(v_anchor_case);
  end if;

  -- Cascades to assignments + status_history; fires the delete audit trigger.
  delete from public.action_items where id = p_id;
end;
$function$;

commit;
