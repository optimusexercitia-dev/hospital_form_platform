-- Migration: case_access grant expiry + reason (LGPD minimum-necessary hygiene)
-- ---------------------------------------------------------------------------
-- Adds grant-lifecycle hygiene to the per-case ACL `public.case_access`:
--   * `expires_at timestamptz` (nullable — NULL = no expiry / "sem prazo");
--   * `reason text` (nullable; CHECK not-blank when present) — the LGPD /
--     accreditation-evidence justification for the grant.
--
-- An EXPIRED grant row is KEPT (the access panel shows "Expirada"; re-granting
-- refreshes it; revoke still deletes). Access is denied by adding the filter
--     (expires_at is null or expires_at > now())
-- to the `case_access` GRANT arm of EVERY predicate that consults it for
-- authority — verified by grepping `case_access` across all applied migrations:
--   1. app.can_read_case            (grant arm)
--   2. app.can_read_case_patient    (grant arm; PHI — Rule 12)
--   3. app.can_write_case_content   (grant arm; covers can_write_case_narrative
--                                     by delegation)
--   4. get_member_overview          (case-count grant arm; migration 20260707,
--                                     the current definition)
--   5. app.referral_target_analyst  (grant arm; feeds app.can_read_referral_phi —
--                                     PHI, Rule 12; an expired grantee must NOT
--                                     retain referral-PHI read)
--   6. public.list_my_cases         (BOTH arms — the `my_role` collaborator chip
--                                     and the "Meus Casos" list membership)
--
-- "Expired means expired everywhere" — the six-consulter scope was corrected from
-- the plan's original four after backend exploration found the referral-PHI and
-- Meus-Casos leaks (lead-ruled: Option 1). `list_case_access` returns the grant
-- rows (no authority filter) and gains `expires_at`/`reason` in its projection.
--
-- Each `create or replace` below preserves the function's EXACT current body +
-- attributes (owner postgres, pinned search_path, REVOKE->GRANT) and adds ONLY
-- the expiry predicate — no other refactor. Forward-only, additive; must NOT edit
-- prior migrations (remote-history rules).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Columns
-- ===========================================================================
alter table public.case_access
  add column if not exists expires_at timestamptz,
  add column if not exists reason text;

alter table public.case_access
  add constraint case_access_reason_not_blank
    check (reason is null or btrim(reason) <> '');

comment on column public.case_access.expires_at is
  'Optional grant expiry (NULL = no expiry / "sem prazo"). An expired row is KEPT '
  '(the panel shows "Expirada"; re-granting refreshes it) but is DENIED by every '
  'authority predicate via the filter (expires_at is null or expires_at > now()). '
  'LGPD minimum-necessary / accreditation-evidence hygiene.';
comment on column public.case_access.reason is
  'Optional pt-BR justification for the grant (LGPD / accreditation evidence). '
  'Not blank when present; not PHI.';

-- ===========================================================================
-- 2. Authority predicates — add the expiry filter to each grant arm
-- ===========================================================================

-- --- (1) app.can_read_case -------------------------------------------------
create or replace function app.can_read_case(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — now per-org (the org's NSP roster).
  if app.feature_enabled('case_referrals')
     and app.is_pqs_member_of_for(app.org_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  -- Flag-OFF fallback: member-read + org-governance (org-bounded; unaffected).
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid)
        or app.is_org_admin_of_commission_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_org_admin_of_commission_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

alter function app.can_read_case(uuid, uuid) owner to postgres;

-- --- (2) app.can_read_case_patient (PHI — Rule 12) -------------------------
create or replace function app.can_read_case_patient(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — now per-org (the org's NSP roster).
  if app.feature_enabled('case_referrals')
     and app.is_pqs_member_of_for(app.org_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  -- Flag-OFF fallback: member-read (org-bounded; PHI never follows org governance).
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

alter function app.can_read_case_patient(uuid, uuid) owner to postgres;

-- --- (3) app.can_write_case_content ----------------------------------------
create or replace function app.can_write_case_content(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = 'write'
        and (ca.expires_at is null or ca.expires_at > now())
    );
end;
$$;

alter function app.can_write_case_content(uuid, uuid) owner to postgres;

-- --- (5) app.referral_target_analyst (PHI arm — Rule 12; feeds can_read_referral_phi) ---
create or replace function app.referral_target_analyst(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and r.target_case_id is not null
      and (
        exists (select 1 from public.case_phases cp
                where cp.case_id = r.target_case_id and cp.assigned_to = p_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = r.target_case_id and cn.assigned_to = p_uid)
        or exists (select 1 from public.case_access ca
                   where ca.case_id = r.target_case_id and ca.user_id = p_uid
                     and (ca.expires_at is null or ca.expires_at > now()))
      )
  );
$$;

alter function app.referral_target_analyst(uuid, uuid) owner to postgres;
revoke all on function app.referral_target_analyst(uuid, uuid) from public;
grant all on function app.referral_target_analyst(uuid, uuid) to authenticated;
grant all on function app.referral_target_analyst(uuid, uuid) to service_role;

-- --- (6) public.list_my_cases (BOTH arms — my_role chip + list membership) --
create or replace function public.list_my_cases(p_commission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
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
                 or app.is_org_admin_of_commission_for(c.commission_id, v_uid) then 'coordinator'
            when exists (
              select 1 from public.case_access ca
              where ca.case_id = c.id and ca.user_id = v_uid and ca.level = 'write'
                and (ca.expires_at is null or ca.expires_at > now())
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
      -- 'coordinator' role chip. An EXPIRED grant no longer keeps a case here.
      and (
        exists (select 1 from public.case_access ca
                where ca.case_id = c.id and ca.user_id = v_uid
                  and (ca.expires_at is null or ca.expires_at > now()))
        or exists (select 1 from public.case_phases cp
                   where cp.case_id = c.id and cp.assigned_to = v_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = c.id and cn.assigned_to = v_uid)
      )
  ) rows;

  return v_result;
end;
$$;

alter function public.list_my_cases(uuid) owner to postgres;
revoke all on function public.list_my_cases(uuid) from public;
grant all on function public.list_my_cases(uuid) to authenticated;
grant all on function public.list_my_cases(uuid) to service_role;

-- --- (4) get_member_overview (case-count grant arm) ------------------------
-- Redefines the migration-20260707 version, adding the expiry filter to the
-- case_access grant leg of count (1). Everything else (the folded pending
-- action-items union, meetings, signatures, drafts) is byte-for-byte identical
-- to 20260707 — this migration only closes the expiry gap now that the column
-- exists.
create or replace function public.get_member_overview(p_commission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_cases_flag boolean := app.feature_enabled('cases_extras');
  v_case_access_flag boolean := app.feature_enabled('case_access');
  v_meetings_flag boolean := app.feature_enabled('meetings');
  v_action_items_flag boolean := app.feature_enabled('action_items');

  v_cases_not_concluded int := 0;
  v_pending_action_items int := 0;
  v_pending_overdue int := 0;
  v_meetings_not_concluded int := 0;
  v_next_meeting_start timestamptz := null;
  v_pending_signatures int := 0;
  v_in_progress_responses int := 0;
begin
  if v_uid is null then
    return jsonb_build_object(
      'cases_not_concluded', 0,
      'pending_action_items', 0,
      'pending_action_items_overdue', 0,
      'meetings_not_concluded', 0,
      'next_meeting_start', null,
      'pending_signatures', 0,
      'in_progress_responses', 0
    );
  end if;

  -- (1) Cases not concluded — PERSONAL interpretation (ADR: the human spec).
  -- The case_access grant leg now carries the expiry filter — an expired grant
  -- no longer counts a case toward this member's not-concluded tally.
  if v_cases_flag then
    select count(*) into v_cases_not_concluded
    from public.cases c
    where c.commission_id = p_commission
      and c.status not in ('concluido', 'cancelado')
      and (
        exists (
          select 1 from public.case_phases cp
          where cp.case_id = c.id and cp.assigned_to = v_uid
        )
        or exists (
          select 1 from public.case_narratives cn
          where cn.case_id = c.id and cn.assigned_to = v_uid
        )
        or (
          v_case_access_flag
          and exists (
            select 1 from public.case_access ca
            where ca.case_id = c.id and ca.user_id = v_uid
              and (ca.expires_at is null or ca.expires_at > now())
          )
        )
      );
  end if;

  -- (2) Pending action items assigned to the caller (non-terminal status), plus
  -- how many are overdue (due_date < today). ONE hub source now: case-sourced
  -- rows gated by cases_extras, meeting/manual rows by action_items.
  select
    count(*),
    count(*) filter (where due_date is not null and due_date < current_date)
    into v_pending_action_items, v_pending_overdue
  from (
    select ai.due_date
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    where ai.assigned_to = v_uid
      and ai.commission_id = p_commission
      and st.is_terminal = false
      and (
        (ai.source_type = 'case' and v_cases_flag)
        or (ai.source_type in ('meeting', 'manual') and v_action_items_flag)
      )
  ) pend;

  -- (3) Meetings not concluded the caller ATTENDS, + the next upcoming start.
  if v_meetings_flag then
    select
      count(*),
      min(m.scheduled_start) filter (where m.scheduled_start >= now())
      into v_meetings_not_concluded, v_next_meeting_start
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and m.status in ('agendada', 'realizada', 'em_assinatura');
  end if;

  -- (4) Pending meeting-minute signatures.
  if v_meetings_flag then
    select count(*) into v_pending_signatures
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and a.attendance = 'presente'
      and m.status = 'em_assinatura'
      and not exists (
        select 1 from public.meeting_signatures s
        where s.attendee_id = a.id and s.status = 'signed'
      );
  end if;

  -- (5) The caller's own in_progress form responses (drafts) in this commission.
  select count(*) into v_in_progress_responses
  from public.responses r
  where r.created_by = v_uid
    and r.commission_id = p_commission
    and r.status = 'in_progress';

  return jsonb_build_object(
    'cases_not_concluded', v_cases_not_concluded,
    'pending_action_items', v_pending_action_items,
    'pending_action_items_overdue', v_pending_overdue,
    'meetings_not_concluded', v_meetings_not_concluded,
    'next_meeting_start', v_next_meeting_start,
    'pending_signatures', v_pending_signatures,
    'in_progress_responses', v_in_progress_responses
  );
end;
$$;

alter function public.get_member_overview(uuid) owner to postgres;
revoke all on function public.get_member_overview(uuid) from public;
grant execute on function public.get_member_overview(uuid) to authenticated;
grant execute on function public.get_member_overview(uuid) to service_role;
comment on function public.get_member_overview(uuid) is
  'Self-scoped per-member "Visão Geral" for one commission: 5 counts + 2 hints. '
  'Pending action items count the shared action_items hub (case arm gated by '
  'cases_extras, meeting/manual arm by action_items). The cases-not-concluded '
  'case_access grant leg honors the grant expiry filter. No audit row.';

-- ===========================================================================
-- 3. grant_case_access — new signature with expiry + reason
-- ===========================================================================
-- Upsert refreshes level/granted_by/granted_at/expires_at/reason. p_expires_at,
-- when provided, must be in the future. p_reason is trimmed to NULL when blank.
create or replace function public.grant_case_access(
  p_case uuid,
  p_user uuid,
  p_level text,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_level not in ('read', 'write') then
    raise exception 'nível de acesso inválido' using errcode = 'check_violation';
  end if;
  -- The grantee must be a current member of the case's commission (HC021).
  if not app.is_member_of_for(v_commission, p_user) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  -- An expiry, when set, must be in the future.
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'a data de expiração deve ser futura' using errcode = 'check_violation';
  end if;

  insert into public.case_access (case_id, user_id, level, granted_by, granted_at, expires_at, reason)
  values (p_case, p_user, p_level, auth.uid(), now(), p_expires_at, nullif(btrim(p_reason), ''))
  on conflict (case_id, user_id)
  do update set level = excluded.level, granted_by = excluded.granted_by,
                granted_at = excluded.granted_at,
                expires_at = excluded.expires_at, reason = excluded.reason;
end;
$$;

alter function public.grant_case_access(uuid, uuid, text, timestamptz, text) owner to postgres;
revoke all on function public.grant_case_access(uuid, uuid, text, timestamptz, text) from public;
grant all on function public.grant_case_access(uuid, uuid, text, timestamptz, text) to authenticated;
grant all on function public.grant_case_access(uuid, uuid, text, timestamptz, text) to service_role;
comment on function public.grant_case_access(uuid, uuid, text, timestamptz, text) is
  'Grant a commission member read/write access to a case (upsert — re-granting '
  'refreshes level/granted_by/granted_at/expires_at/reason). Coordinator-only; '
  'grantee must be a current member (HC021). p_expires_at (nullable) must be '
  'future; p_reason (nullable, trimmed) is the LGPD/evidence justification. An '
  'expired grant is DENIED by all authority predicates but KEPT until re-granted '
  'or revoked (ADR 0033 D6).';

-- Drop the OLD 3-arg signature (superseded by the 5-arg one above).
drop function if exists public.grant_case_access(uuid, uuid, text);

-- ===========================================================================
-- 4. list_case_access — return expires_at + reason
-- ===========================================================================
-- The OUT-parameter row type changes (adds granted_at/expires_at/reason), so a
-- plain CREATE OR REPLACE cannot alter the return type — drop the old one first.
drop function if exists public.list_case_access(uuid);
create or replace function public.list_case_access(p_case uuid)
returns table(user_id uuid, level text, granted_at timestamptz, expires_at timestamptz, reason text)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  -- Respect the case_access feature flag, exactly like grant_case_access.
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  -- DEFINER: the RLS bypass is intentional, so this internal coordinator/admin
  -- gate is the authority (mirrors grant_case_access / revoke_case_access).
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  return query
    select ca.user_id, ca.level, ca.granted_at, ca.expires_at, ca.reason
    from public.case_access ca
    where ca.case_id = p_case
    order by ca.granted_at;
end;
$$;

alter function public.list_case_access(uuid) owner to postgres;
revoke all on function public.list_case_access(uuid) from public;
grant all on function public.list_case_access(uuid) to authenticated;
grant all on function public.list_case_access(uuid) to service_role;
comment on function public.list_case_access(uuid) is
  'Coordinator/admin-gated read of the explicit case_access grant rows for a case '
  '(ADR 0033 D6). SECURITY DEFINER; mirrors grant_case_access authz. Returns '
  '(user_id, level, granted_at, expires_at, reason) — a row with expires_at in the '
  'past is shown as "Expirada" by the panel. Grants are config (not PHI), no audit row.';

-- ===========================================================================
-- 5. Audit — track expires_at + reason on case_access changes
-- ===========================================================================
create or replace function app.trg_audit_case_access()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array['level', 'expires_at', 'reason'];
  v_case uuid;
  v_user uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_case := old.case_id; v_user := old.user_id; v_action := 'case_access.revoked';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_case := new.case_id; v_user := new.user_id; v_action := 'case_access.granted';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_case := new.case_id; v_user := new.user_id; v_action := 'case_access.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;

  perform app.audit_write(v_action, 'case_access', v_case,
    app.commission_of_case(v_case),
    'Acesso ao caso ' || tg_op || ' (membro ' || coalesce(v_user::text, '?') || ')',
    v_meta);
  return null;
end;
$$;

alter function app.trg_audit_case_access() owner to postgres;
