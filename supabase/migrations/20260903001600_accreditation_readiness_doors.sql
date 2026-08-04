-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration E:
-- the three read doors. ADR 0093 D5/D6/D7/D8. The highest-risk migration in
-- the phase — structurally mirrors app.hospital_document_register /
-- app.hospital_indicator_rollup (live bodies read from pg_proc: empty-deny
-- via `if not (gate) then return; end if;`, STABLE SECURITY DEFINER,
-- search_path pinned) but DELIBERATELY WITHOUT their `is_admin()` arm —
-- that arm is BUG-AUTHZ-002 (filed against hospital_document_register this
-- week). This migration copies the SHAPE, not the defect: platform_admin
-- gets ZERO rows from all three doors below, tested by construction in
-- pgTAP 283/284 (the BUG-AUTHZ-001 shape).
--
-- app.evidence_label_of(kind, artifact) -> text — a THIRD dispatch helper
-- (siblings: app.artifact_belongs_to_commission, app.evidence_status_of,
-- Migration B), needed by readiness_evidence's per-link display label. Same
-- posture: one arm per evidence_links.artifact_kind CHECK value, ELSE
-- raises (D4 "every sibling arm"). Falls back to 'Item removido' for a
-- since-deleted artifact rather than NULL (label is a required field).
--
-- public.readiness_report(commission, framework) -- gate is_member_of ONLY.
-- Per-standard rows for every standard in the (reachable) framework:
-- assessment status (null = not yet assessed) + evidence counts split by
-- freshness. A case/ethics_procedure link the CALLER cannot currently read
-- (app.can_read_case) is counted into evidence_restrita ONLY, never into
-- valida/atencao/vencida — masking the same way readiness_evidence does,
-- consistently. NEVER returns note (D8).
--
-- public.readiness_evidence(commission, standard) -- gate is_member_of
-- ONLY. Per-link items; a restricted link (case/ethics_procedure the caller
-- cannot read) is masked per D8: label = "Evidência restrita", note = NULL,
-- restricted = true. `status` is NOT masked even when restricted — for
-- case/ethics_procedure kinds evidence_status_of is a hardcoded constant
-- ('valida', D5 "always valida") that carries no case-specific signal, so
-- returning it discloses nothing about the target beyond what the kind
-- itself already reveals.
--
-- public.hospital_readiness(hospital, framework) -- gate
-- is_hospital_admin_of(hospital) OR is_org_admin_of(org_of_hospital(hospital))
-- ONLY (D6 noun rule — no is_admin() arm). Consolidation per D7:
--   - A standard_ownerships row for this hospital+standard -> resolution =
--     'responsavel'; consolidated_status = THAT commission's own
--     assessment status, which may be NULL (override-to-unassessed is a
--     valid state, not an error).
--   - Otherwise: gather every hospital commission's assessment status for
--     the standard (commissions with no assessment contribute nothing —
--     same "not yet assessed" semantics as readiness_report). No
--     assessments at all -> status NULL, resolution 'unanime' (vacuously —
--     nothing to disagree about). All non-null statuses equal
--     'nao_aplicavel' -> status 'nao_aplicavel', resolution 'unanime'.
--     Otherwise nao_aplicavel votes are treated as ABSTENTIONS: excluded,
--     then worst-status-wins (nao_conforme > parcial > conforme) over the
--     remainder; if the remainder is a single distinct value, resolution
--     stays 'unanime' (abstentions do not manufacture disagreement);
--     otherwise 'pior_caso'.
-- Evidence counts aggregate across ALL of the hospital's commissions'
-- links for the standard (evidence-gathering is not restricted to the
-- responsible commission — only the ASSESSMENT authority is). Counts
-- only, no note (D8) — the minimum-necessary hospital-tier read.

create function app.evidence_label_of(p_kind text, p_artifact uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_label text;
begin
  case p_kind
    when 'form' then
      select f.title into v_label from public.forms f where f.id = p_artifact;

    when 'form_version' then
      select fo.title || ' — v' || fv.version_number into v_label
      from public.form_versions fv
      join public.forms fo on fo.id = fv.form_id
      where fv.id = p_artifact;

    when 'meeting' then
      select m.title into v_label from public.meetings m where m.id = p_artifact;

    when 'case' then
      select coalesce(c.label, 'Caso #' || c.case_number) into v_label
      from public.cases c where c.id = p_artifact;

    when 'indicator' then
      select i.name into v_label from public.indicators i where i.id = p_artifact;

    when 'controlled_document' then
      select d.title into v_label from public.controlled_documents d where d.id = p_artifact;

    when 'action_item' then
      select ai.title into v_label from public.action_items ai where ai.id = p_artifact;

    when 'capa_plan' then
      select cp.code into v_label from public.capa_plan cp where cp.id = p_artifact;

    when 'charter' then
      select 'Regimento da comissão' into v_label
      from public.commission_charters cc where cc.commission_id = p_artifact;

    when 'ethics_procedure' then
      select coalesce(c.label, 'Caso #' || c.case_number) into v_label
      from public.cases c where c.id = p_artifact;

    else
      raise exception 'evidence_label_of: unrecognized artifact_kind %', p_kind;
  end case;

  return coalesce(v_label, 'Item removido');
end;
$$;

create function public.readiness_report(p_commission uuid, p_framework uuid)
returns table(
  standard_id uuid,
  standard_code text,
  standard_title text,
  level smallint,
  assessment_status text,
  evidence_valida bigint,
  evidence_atencao bigint,
  evidence_vencida bigint,
  evidence_restrita bigint
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  perform app.assert_accreditation_enabled();

  if not app.is_member_of(p_commission) then
    return;
  end if;

  return query
  with links as (
    select el.standard_id,
      case
        when el.artifact_kind in ('case', 'ethics_procedure')
             and not app.can_read_case(el.artifact_id, v_uid)
          then 'restrita'
        else app.evidence_status_of(el.artifact_kind, el.artifact_id)
      end as bucket
    from public.evidence_links el
    where el.commission_id = p_commission
  )
  select
    s.id,
    s.code,
    s.title,
    s.level,
    sa.status,
    count(*) filter (where l.bucket = 'valida'),
    count(*) filter (where l.bucket = 'atencao'),
    count(*) filter (where l.bucket = 'vencida'),
    count(*) filter (where l.bucket = 'restrita')
  from public.accreditation_standards s
  join public.accreditation_frameworks f on f.id = s.framework_id
  left join public.standard_assessments sa
    on sa.standard_id = s.id and sa.commission_id = p_commission
  left join links l on l.standard_id = s.id
  where s.framework_id = p_framework
    and (f.owner_commission_id is null or f.owner_commission_id = p_commission)
  group by s.id, s.code, s.title, s.level, sa.status
  order by s."position";
end;
$$;

create function public.readiness_evidence(p_commission uuid, p_standard uuid)
returns table(
  id uuid,
  standard_id uuid,
  artifact_kind text,
  artifact_id uuid,
  status text,
  label text,
  note text,
  restricted boolean,
  linked_by_name text,
  linked_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  perform app.assert_accreditation_enabled();

  if not app.is_member_of(p_commission) then
    return;
  end if;

  return query
  with links as (
    select el.*,
      (el.artifact_kind in ('case', 'ethics_procedure')
       and not app.can_read_case(el.artifact_id, v_uid)) as is_restricted
    from public.evidence_links el
    where el.commission_id = p_commission and el.standard_id = p_standard
  )
  select
    l.id,
    l.standard_id,
    l.artifact_kind,
    l.artifact_id,
    app.evidence_status_of(l.artifact_kind, l.artifact_id),
    case when l.is_restricted then 'Evidência restrita'
         else app.evidence_label_of(l.artifact_kind, l.artifact_id) end,
    case when l.is_restricted then null else l.note end,
    l.is_restricted,
    p.full_name,
    l.linked_at
  from links l
  left join public.profiles p on p.id = l.linked_by
  order by l.linked_at desc;
end;
$$;

create function public.hospital_readiness(p_hospital uuid, p_framework uuid)
returns table(
  standard_id uuid,
  standard_code text,
  standard_title text,
  level smallint,
  consolidated_status text,
  resolution text,
  responsible_commission_id uuid,
  evidence_valida bigint,
  evidence_atencao bigint,
  evidence_vencida bigint,
  evidence_restrita bigint
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reachable boolean;
begin
  perform app.assert_accreditation_enabled();

  if not (app.is_hospital_admin_of(p_hospital)
          or app.is_org_admin_of(app.org_of_hospital(p_hospital))) then
    return;
  end if;

  select exists (
    select 1 from public.accreditation_frameworks f
    where f.id = p_framework
      and (
        f.owner_commission_id is null
        or exists (
          select 1 from public.commissions c
          where c.id = f.owner_commission_id and c.hospital_id = p_hospital
        )
      )
  ) into v_reachable;

  if not v_reachable then
    return;
  end if;

  return query
  with hosp_comms as (
    select id from public.commissions where hospital_id = p_hospital
  ),
  per_comm_assess as (
    select sa.standard_id, sa.commission_id, sa.status
    from public.standard_assessments sa
    where sa.commission_id in (select id from hosp_comms)
  ),
  owner_row as (
    select so.standard_id, so.responsible_commission_id
    from public.standard_ownerships so
    where so.hospital_id = p_hospital
  ),
  per_standard as (
    select
      s.id as standard_id,
      ow.responsible_commission_id,
      (select pca.status from per_comm_assess pca
         where pca.standard_id = s.id and pca.commission_id = ow.responsible_commission_id
      ) as owner_status,
      (select array_agg(distinct pca.status) from per_comm_assess pca
         where pca.standard_id = s.id
      ) as statuses
    from public.accreditation_standards s
    left join owner_row ow on ow.standard_id = s.id
    where s.framework_id = p_framework
  ),
  links as (
    select el.standard_id,
      case
        when el.artifact_kind in ('case', 'ethics_procedure')
             and not app.can_read_case(el.artifact_id, v_uid)
          then 'restrita'
        else app.evidence_status_of(el.artifact_kind, el.artifact_id)
      end as bucket
    from public.evidence_links el
    where el.commission_id in (select id from hosp_comms)
  )
  select
    s.id,
    s.code,
    s.title,
    s.level,
    case
      when ps.responsible_commission_id is not null then ps.owner_status
      when ps.statuses is null then null
      when ps.statuses = array['nao_aplicavel'] then 'nao_aplicavel'
      else (
        select x from unnest(ps.statuses) x where x <> 'nao_aplicavel'
        order by case x
          when 'nao_conforme' then 1
          when 'parcial' then 2
          when 'conforme' then 3
        end
        limit 1
      )
    end,
    case
      when ps.responsible_commission_id is not null then 'responsavel'
      when ps.statuses is null then 'unanime'
      when ps.statuses = array['nao_aplicavel'] then 'unanime'
      when (select count(distinct x) from unnest(ps.statuses) x where x <> 'nao_aplicavel') <= 1
        then 'unanime'
      else 'pior_caso'
    end,
    ps.responsible_commission_id,
    count(l.*) filter (where l.bucket = 'valida'),
    count(l.*) filter (where l.bucket = 'atencao'),
    count(l.*) filter (where l.bucket = 'vencida'),
    count(l.*) filter (where l.bucket = 'restrita')
  from public.accreditation_standards s
  join per_standard ps on ps.standard_id = s.id
  left join links l on l.standard_id = s.id
  where s.framework_id = p_framework
  group by s.id, s.code, s.title, s.level, ps.responsible_commission_id, ps.owner_status, ps.statuses
  order by s."position";
end;
$$;

revoke execute on function public.readiness_report(uuid, uuid) from public;
grant execute on function public.readiness_report(uuid, uuid) to authenticated;

revoke execute on function public.readiness_evidence(uuid, uuid) from public;
grant execute on function public.readiness_evidence(uuid, uuid) to authenticated;

revoke execute on function public.hospital_readiness(uuid, uuid) from public;
grant execute on function public.hospital_readiness(uuid, uuid) to authenticated;
