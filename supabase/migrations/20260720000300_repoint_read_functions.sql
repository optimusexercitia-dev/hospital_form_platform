-- ============================================================================
-- MEM-4 (cont.) · Repoint every remaining SQL function that reads a membership
--   table directly (beyond the predicates + door + shims) to source from
--   public.memberships. These are bespoke reads (rollups, rosters, eligible-user
--   lists, meeting seeds) — mechanical column-per-scope repoints, authority + output
--   shapes UNCHANGED. added_at/added_by → granted_at/granted_by; user_id →
--   principal_id. All keep their exact signatures (frozen). t19 grants re-issued
--   only where a DROP+recreate was needed (none here — all CREATE OR REPLACE).
--
-- Verified surface (live catalog): commission_overview, capa_kpis, pqs_inbox,
--   list_addable_commission_members, list_approver_candidates,
--   list_hospital_eligible_users_for_pqs, list_my_nsp_hospitals,
--   list_org_eligible_users, list_pqs_members, nsp_org_roster, open_capa_plan,
--   conclude_meeting, seed_expected_meeting_attendees,
--   seed_selected_meeting_attendees, assign_member_title, appoint_administrativo.
-- ============================================================================

-- commission_overview — org_admin's commissions. Was `organization_members` scan.
create or replace function public.commission_overview()
returns table(commission_id uuid, commission_name text, slug text, form_count bigint, submitted_count bigint, submitted_last_30_days bigint)
language plpgsql stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  return query
  select c.id, c.name, c.slug::text,
         (select count(distinct f.id)
            from public.forms f
            join public.form_versions fv on fv.form_id = f.id and fv.status = 'published'
            where f.commission_id = c.id) as form_count,
         (select count(r.id) from public.responses r
            where r.commission_id = c.id and r.status = 'submitted' and r.case_phase_id is null) as submitted_count,
         (select count(r.id) from public.responses r
            where r.commission_id = c.id and r.status = 'submitted' and r.case_phase_id is null
              and r.submitted_at >= now() - interval '30 days') as submitted_last_30_days
  from public.commissions c
  where c.organization_id in (
    select m.organization_id from public.memberships m
    where m.principal_id = auth.uid() and m.role = 'org_admin'
  )
  order by c.name;
end;
$$;

-- capa_kpis — operator-hospital scoping. Was pqs_members ∪ organization_members.
create or replace function public.capa_kpis()
returns table(open_count integer, in_verification integer, overdue_actions integer, closed_ytd integer)
language plpgsql stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_hospitals uuid[] := array(
    select m.hospital_id from public.memberships m
    where m.principal_id = auth.uid() and m.role = 'pqs_member'
    union
    select m.hospital_id from public.memberships m
    where m.principal_id = auth.uid() and m.role = 'nsp_coordinator' and m.hospital_id is not null
  );
  v_any boolean := app.is_pqs_member_of_any(auth.uid())
                   or exists (select 1 from public.memberships m
                              where m.principal_id = auth.uid() and m.role = 'nsp_coordinator'
                                and m.hospital_id is not null);
begin
  return query
  with in_scope as (
    select p.*
    from public.capa_plan p
    where v_any
      and (
        app.hospital_of_event(app.event_of_capa(p.id)) is null
        or app.hospital_of_event(app.event_of_capa(p.id)) = any(v_hospitals)
      )
  )
  select
    coalesce(count(*) filter (where status in ('open', 'in_execution', 'in_verification')), 0)::int,
    coalesce(count(*) filter (where status = 'in_verification'), 0)::int,
    coalesce((
      select count(*)
      from public.capa_action a
      join in_scope isp on isp.id = a.capa_id
      where a.due_date < current_date and a.status not in ('completed', 'cancelled')
    ), 0)::int,
    coalesce(count(*) filter (
      where status = 'completed' and closed_at >= date_trunc('year', current_date)
    ), 0)::int
  from in_scope;
end;
$$;

-- pqs_inbox — operator-hospital gate (byte-for-byte scope, ADR 0052). Was the
-- pqs_members ∪ organization_members hospital-set subquery.
create or replace function public.pqs_inbox(p_status text default null, p_suspected_harm_level text default null, p_reporting_commission_id uuid default null, p_cursor_reported_at timestamptz default null, p_cursor_id uuid default null, p_limit integer default 25)
returns table(id uuid, code text, title text, status text, suspected_harm_level text, reporting_commission_id uuid, reporting_commission_name text, current_owner_kind text, current_owner_commission_id uuid, case_id uuid, case_number integer, reported_at timestamptz, acknowledged_at timestamptz)
language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select
    e.id, e.code, e.title, e.status, e.suspected_harm_level,
    e.reporting_commission_id, rc.name,
    e.current_owner_kind, e.current_owner_commission_id,
    e.case_id, c.case_number,
    e.reported_at, e.acknowledged_at
  from public.patient_safety_event e
  join public.commissions rc on rc.id = e.reporting_commission_id
  left join public.cases c on c.id = e.case_id
  where rc.hospital_id in (
          select m.hospital_id from public.memberships m
          where m.principal_id = auth.uid() and m.role = 'pqs_member'
          union
          select m.hospital_id from public.memberships m
          where m.principal_id = auth.uid() and m.role = 'nsp_coordinator' and m.hospital_id is not null
        )
    and (p_status is null or e.status = p_status)
    and (p_suspected_harm_level is null or e.suspected_harm_level = p_suspected_harm_level)
    and (p_reporting_commission_id is null or e.reporting_commission_id = p_reporting_commission_id)
    and (
      p_cursor_reported_at is null
      or (e.reported_at, e.id) < (p_cursor_reported_at, p_cursor_id)
    )
  order by e.reported_at desc, e.id desc
  limit greatest(p_limit, 0);
$$;

-- list_addable_commission_members — "not already a member" via commission-scope rows.
create or replace function public.list_addable_commission_members(p_commission_id uuid, p_search text default null)
returns table(user_id uuid, full_name text, email text)
language plpgsql stable security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_org_id uuid;
  v_q text;
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    return;
  end if;
  select c.organization_id into v_org_id from public.commissions c where c.id = p_commission_id;
  if v_org_id is null then
    return;
  end if;
  v_q := nullif(btrim(coalesce(p_search, '')), '');
  return query
  select pr.id, pr.full_name, pr.email::text
    from public.profiles pr
   where pr.home_organization_id = v_org_id
     and pr.is_active
     and not pr.is_admin
     and not exists (
       select 1 from public.memberships m
        where m.commission_id = p_commission_id and m.principal_id = pr.id
     )
     and (v_q is null or pr.full_name ilike '%' || v_q || '%' or pr.email ilike '%' || v_q || '%')
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$$;

-- list_approver_candidates — members of any commission in the hospital + role-label
-- display hint. Was commission_members × commissions + an organization_members probe.
create or replace function public.list_approver_candidates(p_commission uuid)
returns table(id uuid, name text, title text)
language plpgsql stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_hospital uuid;
begin
  perform app.assert_controlled_docs_enabled();
  v_hospital := app.hospital_of_commission(p_commission);
  if v_hospital is null then
    return;
  end if;
  if not (app.is_staff_admin_of(p_commission)
          or app.is_commission_admin_of(p_commission)
          or app.is_hospital_admin_of(v_hospital)
          or app.is_admin()) then
    return;
  end if;

  return query
  with hospital_users as (
    select distinct m.principal_id as user_id
    from public.memberships m
    join public.commissions c on c.id = m.commission_id
    where m.commission_id is not null and c.hospital_id = v_hospital
  )
  select
    p.id,
    p.full_name,
    case
      when exists (
        select 1 from public.memberships om
        where om.principal_id = p.id
          and (
            (om.role = 'hospital_admin' and om.hospital_id = v_hospital)
            or (om.role = 'org_admin' and om.organization_id = app.org_of_hospital(v_hospital))
          )
      ) then 'Administração'
      when exists (
        select 1 from public.memberships m
        join public.commissions c on c.id = m.commission_id
        where m.principal_id = p.id and c.hospital_id = v_hospital and m.role = 'staff_admin'
      ) then 'Coordenador(a)'
      else 'Membro'
    end::text as title
  from hospital_users hu
  join public.profiles p on p.id = hu.user_id
  where p.is_active = true
  order by p.full_name;
end;
$$;

-- list_hospital_eligible_users_for_pqs — org-tier ∪ commission members of the org.
create or replace function public.list_hospital_eligible_users_for_pqs(p_hospital_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_result jsonb;
  v_org uuid := app.org_of_hospital(p_hospital_id);
begin
  if not (app.is_nsp_org_admin_of(v_org) or app.is_nsp_coordinator_of(p_hospital_id)) then
    raise exception 'apenas o coordenador do NSP ou o administrador de NSP da organização pode listar os usuários elegíveis'
      using errcode = '42501';
  end if;
  with eligible as (
    select m.principal_id as user_id from public.memberships m
    where m.organization_id = v_org
    union
    select m.principal_id from public.memberships m
    join public.commissions c on c.id = m.commission_id
    where m.commission_id is not null and c.organization_id = v_org
  )
  select coalesce(jsonb_agg(
           jsonb_build_object('userId', p.id, 'fullName', p.full_name, 'email', p.email)
           order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from eligible e join public.profiles p on p.id = e.user_id;
  return v_result;
end;
$$;

-- list_my_nsp_hospitals — pqs_member ∪ nsp_coordinator grants of the caller.
-- added_by/added_at not projected; role label from the tier. Output shape frozen.
create or replace function public.list_my_nsp_hospitals()
returns jsonb
language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  with grants as (
    select m.hospital_id, false as is_coord from public.memberships m
      where m.principal_id = auth.uid() and m.role = 'pqs_member'
    union all
    select m.hospital_id, true as is_coord from public.memberships m
      where m.principal_id = auth.uid() and m.role = 'nsp_coordinator' and m.hospital_id is not null
  ),
  rolled as (
    select hospital_id, bool_or(is_coord) as is_coord from grants group by hospital_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id, 'hospitalName', h.name, 'orgId', h.organization_id,
             'role', case when r.is_coord then 'coordinator' else 'member' end
           ) order by h.name
         ), '[]'::jsonb)
  from rolled r join public.hospitals h on h.id = r.hospital_id;
$$;

-- list_org_eligible_users — org-tier ∪ commission members of the org.
create or replace function public.list_org_eligible_users(p_org_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_result jsonb;
begin
  if not (app.is_org_admin_of(p_org_id) or app.is_nsp_org_admin_of(p_org_id)) then
    raise exception 'apenas um administrador da organização pode listar os usuários elegíveis'
      using errcode = '42501';
  end if;
  with eligible as (
    select m.principal_id as user_id from public.memberships m
    where m.organization_id = p_org_id
    union
    select m.principal_id from public.memberships m
    join public.commissions c on c.id = m.commission_id
    where m.commission_id is not null and c.organization_id = p_org_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object('userId', p.id, 'fullName', p.full_name, 'email', p.email)
           order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from eligible e join public.profiles p on p.id = e.user_id;
  return v_result;
end;
$$;

-- list_pqs_members — the hospital's pqs roster. added_at/added_by → granted_at/granted_by
-- (output keys addedAt/addedBy FROZEN for the TS contract).
create or replace function public.list_pqs_members(p_hospital_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_result jsonb;
begin
  if not (app.is_nsp_org_admin_of(app.org_of_hospital(p_hospital_id))
          or app.is_nsp_coordinator_of(p_hospital_id)) then
    raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode listar a equipe'
      using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'userId', m.principal_id, 'fullName', p.full_name, 'email', p.email,
             'addedAt', m.granted_at, 'addedBy', m.granted_by
           ) order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from public.memberships m
    join public.profiles p on p.id = m.principal_id
    where m.hospital_id = p_hospital_id and m.role = 'pqs_member';
  return v_result;
end;
$$;

-- nsp_org_roster — per-hospital coordinator + pqs members. added_at/added_by →
-- granted_at/granted_by (output keys FROZEN).
create or replace function public.nsp_org_roster(p_org_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_result jsonb;
begin
  if not app.is_nsp_org_admin_of(p_org_id) then
    raise exception 'apenas o administrador de NSP da organização pode ver a equipe'
      using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id,
             'hospitalName', h.name,
             'coordinator', (
               select jsonb_build_object('userId', pc.id, 'fullName', pc.full_name, 'email', pc.email)
               from public.memberships om
               join public.profiles pc on pc.id = om.principal_id
               where om.organization_id = p_org_id and om.role = 'nsp_coordinator' and om.hospital_id = h.id
               order by pc.full_name limit 1
             ),
             'members', coalesce((
               select jsonb_agg(
                        jsonb_build_object(
                          'userId', pm.principal_id, 'fullName', pr.full_name, 'email', pr.email,
                          'addedAt', pm.granted_at, 'addedBy', pm.granted_by
                        ) order by pr.full_name)
               from public.memberships pm
               join public.profiles pr on pr.id = pm.principal_id
               where pm.hospital_id = h.id and pm.role = 'pqs_member'
             ), '[]'::jsonb)
           ) order by h.name
         ), '[]'::jsonb)
    into v_result
  from public.hospitals h
  where h.organization_id = p_org_id;
  return v_result;
end;
$$;

-- open_capa_plan — the caller-operator-hospital auto-derive branch reads the roster.
-- Was pqs_members ∪ organization_members; repoint the operator-hospital set.
create or replace function public.open_capa_plan(p_source text, p_classification text default 'corretiva', p_source_id uuid default null, p_hospital_id uuid default null)
returns capa_plan
language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_plan public.capa_plan;
  v_attempts int := 0;
  v_rca uuid;
  v_event uuid;
  v_meeting uuid;
  v_indicator uuid;
  v_audit uuid;
  v_hospital uuid;
  v_op_hospitals uuid[];
begin
  perform app.assert_patient_safety_enabled();
  if p_source not in ('rca', 'event', 'indicator', 'audit_finding', 'meeting', 'manual') then
    raise exception 'origem de plano inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_classification, 'corretiva') not in ('corretiva', 'preventiva', 'melhoria') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;
  if p_source = 'manual' then
    if p_source_id is not null then
      raise exception 'um plano manual não tem origem vinculada' using errcode = 'check_violation';
    end if;
  elsif p_source_id is null then
    raise exception 'informe a origem do plano de ação' using errcode = 'check_violation';
  else
    case p_source
      when 'rca' then v_rca := p_source_id;
      when 'event' then v_event := p_source_id;
      when 'meeting' then v_meeting := p_source_id;
      when 'indicator' then v_indicator := p_source_id;
      when 'audit_finding' then v_audit := p_source_id;
    end case;
  end if;

  v_hospital := case
    when p_source = 'event'     then app.hospital_of_event(v_event)
    when p_source = 'rca'       then app.hospital_of_event(app.event_of_rca(v_rca))
    when p_source = 'meeting'   then app.hospital_of_commission(app.commission_of_meeting(v_meeting))
    when p_source = 'indicator' then app.hospital_of_commission(
                                       (select commission_id from public.indicators where id = v_indicator))
    else null
  end;

  if v_hospital is null then
    if p_hospital_id is not null then
      v_hospital := p_hospital_id;
    else
      select array_agg(distinct h) into v_op_hospitals
      from (
        select m.hospital_id as h from public.memberships m
          where m.principal_id = auth.uid() and m.role = 'pqs_member'
        union
        select m.hospital_id from public.memberships m
          where m.principal_id = auth.uid() and m.role = 'nsp_coordinator' and m.hospital_id is not null
      ) s
      where app.is_pqs_operator_of(h);

      if array_length(v_op_hospitals, 1) = 1 then
        v_hospital := v_op_hospitals[1];
      else
        raise exception 'informe o hospital do plano de ação' using errcode = 'HC083';
      end if;
    end if;
  end if;

  if v_hospital is null or not app.is_pqs_operator_of(v_hospital) then
    raise exception 'apenas o NSP pode abrir planos de ação' using errcode = '42501';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  loop
    begin
      insert into public.capa_plan (
        source, source_rca_id, source_event_id, source_meeting_id,
        source_indicator_id, source_audit_finding_id, classification, opened_by, hospital_id
      ) values (
        p_source, v_rca, v_event, v_meeting, v_indicator, v_audit,
        coalesce(p_classification, 'corretiva'), auth.uid(), v_hospital
      )
      returning * into v_plan;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_plan;
end;
$$;

-- conclude_meeting — eligible-member count = count of the commission's memberships.
-- Only the `select count(*) ... from commission_members` line changes.
create or replace function public.conclude_meeting(p_meeting_id uuid, p_held_at timestamptz default null, p_held_end timestamptz default null)
returns meetings
language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

-- seed_expected_meeting_attendees — summon all commission members. commission_members → memberships.
create or replace function public.seed_expected_meeting_attendees(p_meeting_id uuid)
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);
  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select p_meeting_id, m.principal_id, 'membro', 'summoned'
  from public.memberships m
  where m.commission_id = v_commission_id
  on conflict (meeting_id, user_id) where user_id is not null do nothing;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

-- seed_selected_meeting_attendees — summon a subset. commission_members → memberships.
create or replace function public.seed_selected_meeting_attendees(p_meeting_id uuid, p_user_ids uuid[])
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);
  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select p_meeting_id, m.principal_id, 'membro', 'summoned'
  from public.memberships m
  where m.commission_id = v_commission_id
    and m.principal_id = any (coalesce(p_user_ids, '{}'::uuid[]))
  on conflict (meeting_id, user_id) where user_id is not null do nothing;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

-- assign_member_title — p_member_id resolves memberships.id (commission-scope row).
create or replace function public.assign_member_title(p_member_id uuid, p_title_id uuid default null)
returns void
language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission
  from public.memberships where id = p_member_id;
  if v_commission is null then
    raise exception 'membro inexistente' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.memberships set title_id = p_title_id where id = p_member_id;
end;
$$;

-- appoint_administrativo — target must be a current non-coordinator staff member.
create or replace function public.appoint_administrativo(p_commission_id uuid, p_user_id uuid)
returns void
language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_administrativo_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app._deny_self_grant(p_user_id);
  if not app.is_member_of_for(p_commission_id, p_user_id) then
    raise exception 'o membro deve pertencer à comissão' using errcode = 'HC021';
  end if;
  if not exists (
    select 1 from public.memberships
    where commission_id = p_commission_id and principal_id = p_user_id and role = 'staff'
  ) then
    raise exception 'apenas um membro comum (staff) pode ser designado Administrativo'
      using errcode = '42501';
  end if;
  insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values (p_commission_id, p_user_id, auth.uid())
  on conflict (commission_id, user_id) do nothing;
end;
$$;
