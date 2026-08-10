-- ACT P0 follow-up (ADR 0106) — the 31-function catalog-blindness sweep.
--
-- Coordinator's own catalog sweep (any return type, comment-stripped, `memberships`
-- referenced with NO `has_role`/`active_role` anywhere in the body) found 31
-- functions beyond `list_my_nsp_hospitals`. Every one classified by READING its
-- body (not its name — full 31-row table: `docs/plans/act-as-buildnotes.md`): does
-- the raw `memberships` read authorize the CALLER, or does it enumerate/validate
-- OTHER principals?
--
-- Five are confirmed CALLER-GATING DEFECTS, each with a red-then-green pgTAP
-- keystone (`supabase/tests/316_act_p0_caller_gate_sweep.sql`) proving the raw read
-- was the caller's OWN authorization, not incidental:
--   - public.commission_overview()       — which orgs' commissions the caller sees
--   - public.list_org_people(...)        — the hospital_admin arm of "THE GATE"
--   - public.quality_board_summary(...)  — the top entry gate (the row filter below
--                                          it, is_quality_reviewer_of_for, was
--                                          already hat-gated via has_role)
--   - public.capa_kpis()                 — the nsp_coordinator arm of v_any (the
--                                          pqs_member arm already routed through
--                                          the hat-gated is_pqs_member_of_any)
--   - public.pqs_inbox(...)              — the patient-safety-event inbox scope
--
-- One (public.open_capa_plan) carries the SAME textual pattern (a raw
-- pqs_member/nsp_coordinator union with no hat filter) but proved, on testing,
-- to be already effectively safe: its raw union feeds directly into
-- `where app.is_pqs_operator_of(h)` — already hat-gated — before any decision is
-- made on it, so every call shape tried denies identically whether or not the
-- union itself also carries the hat condition (no red-then-green keystone was
-- constructible against it; a green-on-first-run there would be vacuous). Fixed
-- anyway for consistency with the identical pattern above and as defense-in-depth
-- against a future refactor that drops the adjacent filter — this is a
-- non-regression change, not a security fix, and is reported to the coordinator as
-- such (the AC-5b finding they cited may describe a different code path or a
-- functional, not security, regression — flagged for reconciliation, not guessed).
--
-- The other 25 (24 third-party enumerations + session_context, already ruled
-- hat-blind by design) are UNCHANGED — confirming and recording them, not "fixing"
-- them, per the coordinator's explicit instruction: a roster/candidate/recipient
-- enumeration asking about OTHER people must never be gated on the caller's own
-- hat. No MIXED function (a caller gate AND a third-party enumeration coexisting
-- in one body) was found among the 31.

create or replace function public.commission_overview()
 returns table(commission_id uuid, commission_name text, slug text, form_count bigint, submitted_count bigint, submitted_last_30_days bigint)
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  return query
  select c.id, c.name, c.slug::text,
         (select count(distinct f.id)
            from public.forms f
            join public.form_versions fv on fv.form_id = f.id and fv.status = 'published'
            where f.commission_id = c.id) as form_count,
         (select count(r.id) from public.responses r
            where r.commission_id = c.id and r.status = 'submitted' and r.case_phase_id is null
              and not exists (
                select 1 from public.responses succ
                where succ.supersedes_id = r.id and succ.status = 'submitted'
              )) as submitted_count,
         (select count(r.id) from public.responses r
            where r.commission_id = c.id and r.status = 'submitted' and r.case_phase_id is null
              and r.submitted_at >= now() - interval '30 days'
              and not exists (
                select 1 from public.responses succ
                where succ.supersedes_id = r.id and succ.status = 'submitted'
              )) as submitted_last_30_days
  from public.commissions c
  where c.organization_id in (
    select m.organization_id from public.memberships m
    where m.principal_id = auth.uid() and m.role = 'org_admin'
      -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role.
      and m.role is not distinct from app.active_role()
  )
  order by c.name;
end;
$function$;

create or replace function public.list_org_people(p_org_id uuid, p_search text default null::text, p_cpf text default null::text)
 returns table(user_id uuid, full_name text, email text, professional_category text, is_active boolean, affiliations jsonb)
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid     uuid := (select auth.uid());
  v_q       text := nullif(btrim(coalesce(p_search, '')), '');
  v_cpf     text := nullif(btrim(coalesce(p_cpf, '')), '');
  v_matched uuid;
begin
  -- THE GATE (D10). Inline, deliberately — see the header.
  if not (
    app.is_org_admin_of(p_org_id)
    or (
      app.is_active(v_uid)
      and exists (
        select 1 from public.memberships m
        where m.organization_id = p_org_id
          and m.principal_id = v_uid
          and m.role = 'hospital_admin'
          and (m.expires_at is null or m.expires_at > now())
          -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role.
          and m.role is not distinct from app.active_role()
      )
    )
  ) then
    return;   -- empty, never raises
  end if;

  -- CPF is EXACT-MATCH ONLY, and only at full storage length. A short or malformed
  -- value matches nothing rather than degrading to a prefix search.
  if v_cpf is not null then
    select pr.id into v_matched
    from public.profiles pr
    where pr.home_organization_id = p_org_id
      and not pr.is_admin
      and pr.cpf = v_cpf;

    -- D11 / audit LOW-2: EVERY CPF-parameterised call emits an audit row — actor, org,
    -- and whether it matched (with the matched user_id when it did). NEVER the digits:
    -- Rule 11 records THAT and WHO, never the payload. Name/email searches do not emit,
    -- matching the existing directory door.
    perform app.audit_write(
      'person.cpf_lookup', 'organization', p_org_id, null,
      case when v_matched is null
           then 'Consulta de pessoa por CPF (sem correspondência)'
           else 'Consulta de pessoa por CPF (com correspondência)' end,
      jsonb_build_object('matched', v_matched is not null, 'user_id', v_matched,
                         'source', 'directory'),
      p_org_id, null);

    if v_matched is null then
      return;
    end if;
  end if;

  return query
  select pr.id,
         pr.full_name,
         pr.email::text,
         pc.label_pt,
         pr.is_active,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'hospital_id',   a.hospital_id,
                     'hospital_name', h.name,
                     'started_on',    a.started_on)
                   order by h.name)
              from public.hospital_affiliations a
              join public.hospitals h on h.id = a.hospital_id
             where a.principal_id = pr.id
               and a.ended_on is null
               and a.organization_id = p_org_id),
           '[]'::jsonb)
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.home_organization_id = p_org_id
     -- platform_admin is not a tenant person and never belongs on a tenant roster
     -- (the noun rule, ADR 0078 A35).
     and not pr.is_admin
     and (v_matched is null or pr.id = v_matched)
     and (v_q is null
          or pr.full_name ilike '%' || v_q || '%'
          or pr.email ilike '%' || v_q || '%')
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$function$;

create or replace function public.quality_board_summary(p_organization_id uuid)
 returns table(commission_id uuid, commission_name text, commission_slug citext, hospital_id uuid, hospital_name text, total_cases integer, open_cases integer, locked_cases integer)
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Gate: an ACTIVE principal holding >= 1 unexpired quality_reviewer membership
  -- in THIS org (cross-org callers and expired reviewers take the same 42501).
  if not (app.is_active(v_uid) and exists (
      select 1 from public.memberships m
      where m.principal_id = v_uid
        and m.role = 'quality_reviewer'
        and m.organization_id = p_organization_id
        and (m.expires_at is null or m.expires_at > now())
        -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role.
        and m.role is not distinct from app.active_role())) then
    raise exception 'apenas revisores da qualidade da organização podem acessar o painel'
      using errcode = '42501';
  end if;

  return query
  select c.id,
         c.name,
         c.slug,
         h.id,
         h.name,
         coalesce(agg.n_total, 0),
         coalesce(agg.n_open, 0),
         coalesce(agg.n_locked, 0)
  from public.commissions c
  join public.hospitals h on h.id = c.hospital_id
  left join lateral (
    select count(*) filter (where r.readable)::int                                                        as n_total,
           count(*) filter (where r.readable and r.status not in ('completed','cancelled'))::int          as n_open,
           count(*) filter (where r.visibility_policy = 'explicit_grants_only' and not r.readable)::int   as n_locked
    from (
      select ca.status, ca.visibility_policy,
             app.can_read_case(ca.id, v_uid) as readable
      from public.cases ca
      where ca.commission_id = c.id
    ) r
  ) agg on true
  where h.organization_id = p_organization_id
    and c.quality_oversight = 'visible'
    and app.is_quality_reviewer_of_for(h.id, v_uid)
  order by h.name, c.name;
end;
$function$;

create or replace function public.capa_kpis()
 returns table(open_count integer, in_verification integer, overdue_actions integer, closed_ytd integer)
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_hospitals uuid[] := array(
    select m.hospital_id from public.memberships m
    where m.principal_id = auth.uid() and m.role = 'pqs_member'
      -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role.
      and m.role is not distinct from app.active_role()
    union
    select m.hospital_id from public.memberships m
    where m.principal_id = auth.uid() and m.role = 'nsp_coordinator' and m.hospital_id is not null
      and m.role is not distinct from app.active_role()
  );
  v_any boolean := app.is_pqs_member_of_any(auth.uid())
                   or exists (select 1 from public.memberships m
                              where m.principal_id = auth.uid() and m.role = 'nsp_coordinator'
                                and m.hospital_id is not null
                                and m.role is not distinct from app.active_role());
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
$function$;

create or replace function public.pqs_inbox(p_status text default null::text, p_suspected_harm_level text default null::text, p_reporting_commission_id uuid default null::uuid, p_cursor_reported_at timestamp with time zone default null::timestamp with time zone, p_cursor_id uuid default null::uuid, p_limit integer default 25)
 returns table(id uuid, code text, title text, status text, suspected_harm_level text, reporting_commission_id uuid, reporting_commission_name text, current_owner_kind text, current_owner_commission_id uuid, case_id uuid, case_number integer, reported_at timestamp with time zone, acknowledged_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
            -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role.
            and m.role is not distinct from app.active_role()
          union
          select m.hospital_id from public.memberships m
          where m.principal_id = auth.uid() and m.role = 'nsp_coordinator' and m.hospital_id is not null
            and m.role is not distinct from app.active_role()
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
$function$;

-- Defense-in-depth only (see the header — not independently exploitable given the
-- adjacent `where app.is_pqs_operator_of(h)` filter, already hat-gated, that this
-- raw union always feeds into before any decision is made on it).
create or replace function public.open_capa_plan(p_source text, p_classification text default 'corretiva'::text, p_source_id uuid default null::uuid, p_hospital_id uuid default null::uuid)
 returns capa_plan
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
            -- ACT (ADR 0106) P0: defense-in-depth (see header) -- the caller's
            -- ACTIVE hat must match this row's role.
            and m.role is not distinct from app.active_role()
        union
        select m.hospital_id from public.memberships m
          where m.principal_id = auth.uid() and m.role = 'nsp_coordinator' and m.hospital_id is not null
            and m.role is not distinct from app.active_role()
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
$function$;
