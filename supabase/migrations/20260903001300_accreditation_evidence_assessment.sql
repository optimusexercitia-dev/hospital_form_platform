-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration D:
-- evidence links, self-assessment, hospital ownership, and the evidence
-- picker's candidate search. ADR 0093 D4/D5/D7/D8 + Amendment 1 A1·1 +
-- docs/plans/phase-16-standards-crosswalk-program.md (Wave 2). Six RPCs:
-- link_evidence, unlink_evidence, set_standard_assessment,
-- set_standard_ownership, evidence_candidates. Every RPC opens with
-- app.assert_accreditation_enabled() -> HC0Q9 (evidence_candidates too — the
-- FF-5 HC0Q3 lesson: an unmapped raise on a search path turns a flag outage
-- into an empty candidate list, which reads as "no candidates" rather than
-- "the feature is off" — a wrong answer presented confidently).
--
-- No new write grants to `authenticated` anywhere else — every write these
-- five functions perform stays behind this DEFINER door (re-verified with a
-- live ACL query, not by reading this file — see the turn's report).

-- ---------------------------------------------------------------------------
-- link_evidence — staff_admin of the linking commission. GUARD ORDER IS PART
-- OF THE CONTRACT: flag -> standard exists & reachable -> belongs (D4) ->
-- can_read_case (case AND ethics_procedure) -> can_read_capa (capa_plan,
-- Amendment 1 A1·1) -> duplicate (HC0QB) -> insert. A read check that runs
-- AFTER the insert is not a read check — every reachability/access check
-- below completes before any row is written.
-- ---------------------------------------------------------------------------
create function public.link_evidence(
  p_commission uuid,
  p_standard uuid,
  p_kind text,
  p_artifact uuid,
  p_note text default null
)
returns public.evidence_links
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result public.evidence_links;
begin
  perform app.assert_accreditation_enabled();

  if not app.is_staff_admin_of(p_commission) then
    raise exception 'você não pode gerenciar evidências nesta comissão'
      using errcode = '42501';
  end if;

  -- The standard must exist AND be reachable from this commission (global,
  -- or owned by p_commission itself) — this is SECURITY DEFINER, so RLS's
  -- own scoping does not protect this lookup.
  if not exists (
    select 1
    from public.accreditation_standards s
    join public.accreditation_frameworks f on f.id = s.framework_id
    where s.id = p_standard
      and (f.owner_commission_id is null or f.owner_commission_id = p_commission)
  ) then
    raise exception 'padrão não encontrado ou não disponível para esta comissão'
      using errcode = 'HC0QC';
  end if;

  if not app.artifact_belongs_to_commission(p_kind, p_artifact, p_commission) then
    raise exception 'este item não pertence a esta comissão ou não pode ser vinculado como evidência'
      using errcode = 'HC0QA';
  end if;

  if p_kind in ('case', 'ethics_procedure') and not app.can_read_case(p_artifact, v_uid) then
    raise exception 'você não tem acesso a este caso' using errcode = '42501';
  end if;

  if p_kind = 'capa_plan' and not app.can_read_capa(p_artifact, v_uid) then
    raise exception 'você não tem acesso a este plano CAPA' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.evidence_links
    where commission_id = p_commission and standard_id = p_standard
      and artifact_kind = p_kind and artifact_id = p_artifact
  ) then
    raise exception 'esta evidência já está vinculada a este padrão' using errcode = 'HC0QB';
  end if;

  insert into public.evidence_links (commission_id, standard_id, artifact_kind, artifact_id, note, linked_by)
  values (p_commission, p_standard, p_kind, p_artifact, p_note, v_uid)
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- unlink_evidence — staff_admin of the link's own commission (resolved from
-- the row, not passed by the caller, so a caller cannot claim a foreign
-- commission to unlink someone else's evidence).
-- ---------------------------------------------------------------------------
create function public.unlink_evidence(p_link uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  perform app.assert_accreditation_enabled();

  select commission_id into v_commission from public.evidence_links where id = p_link;

  if v_commission is null then
    raise exception 'vínculo de evidência não encontrado' using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_commission) then
    raise exception 'você não pode gerenciar evidências nesta comissão'
      using errcode = '42501';
  end if;

  delete from public.evidence_links where id = p_link;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_standard_assessment — staff_admin upsert (one row per commission +
-- standard; re-assessing advances assessed_at in place, never a new row).
-- ---------------------------------------------------------------------------
create function public.set_standard_assessment(
  p_commission uuid,
  p_standard uuid,
  p_status text,
  p_note_md text default null
)
returns public.standard_assessments
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result public.standard_assessments;
begin
  perform app.assert_accreditation_enabled();

  if not app.is_staff_admin_of(p_commission) then
    raise exception 'você não pode avaliar padrões nesta comissão'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.accreditation_standards s
    join public.accreditation_frameworks f on f.id = s.framework_id
    where s.id = p_standard
      and (f.owner_commission_id is null or f.owner_commission_id = p_commission)
  ) then
    raise exception 'padrão não encontrado ou não disponível para esta comissão'
      using errcode = 'HC0QC';
  end if;

  insert into public.standard_assessments (commission_id, standard_id, status, assessed_by, note_md)
  values (p_commission, p_standard, p_status, v_uid, p_note_md)
  on conflict (commission_id, standard_id)
  do update set
    status = excluded.status,
    assessed_by = excluded.assessed_by,
    assessed_at = now(),
    note_md = excluded.note_md
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_standard_ownership — is_hospital_admin_of ONLY (D7). org_admin can
-- READ the hospital surface (Migration E) but is REJECTED here — a
-- deliberate read/write asymmetry, not an oversight. NULL p_commission
-- clears the override (deletes the row); the hospital/commission match is
-- validated explicitly BEFORE the insert so HC0QC (curated pt-BR) fires
-- instead of the schema backstop trigger's generic 23514 — that trigger
-- should now be unreachable through this RPC.
-- ---------------------------------------------------------------------------
create function public.set_standard_ownership(
  p_hospital uuid,
  p_standard uuid,
  p_commission uuid default null
)
returns public.standard_ownerships
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result public.standard_ownerships;
  v_commission_hospital uuid;
begin
  perform app.assert_accreditation_enabled();

  if not app.is_hospital_admin_of(p_hospital) then
    raise exception 'apenas o administrador do hospital pode definir a comissão responsável'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.accreditation_standards where id = p_standard) then
    raise exception 'padrão não encontrado' using errcode = 'HC0QC';
  end if;

  if p_commission is null then
    delete from public.standard_ownerships where hospital_id = p_hospital and standard_id = p_standard;
    return null;
  end if;

  v_commission_hospital := app.hospital_of_commission(p_commission);
  if v_commission_hospital is distinct from p_hospital then
    raise exception 'a comissão informada não pertence a este hospital'
      using errcode = 'HC0QC';
  end if;

  insert into public.standard_ownerships (hospital_id, standard_id, responsible_commission_id, assigned_by)
  values (p_hospital, p_standard, p_commission, v_uid)
  on conflict (hospital_id, standard_id)
  do update set
    responsible_commission_id = excluded.responsible_commission_id,
    assigned_by = excluded.assigned_by,
    assigned_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- evidence_candidates — staff_admin DEFINER search feeding the evidence
-- picker. Per-kind SELECTs, each already scoped to p_commission (or, for
-- capa_plan, the commission's hospital) so a result is never offered unless
-- it would also pass link_evidence's belongs check; case/ethics_procedure
-- additionally filtered by can_read_case, capa_plan by can_read_capa — a
-- candidate never appears if the caller could not read it (unlike an
-- already-linked evidence row, which may be masked post-hoc at the read
-- door instead).
-- ---------------------------------------------------------------------------
create function public.evidence_candidates(p_commission uuid, p_kind text, p_query text default null)
returns table(id uuid, label text, sublabel text)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_hospital uuid;
begin
  perform app.assert_accreditation_enabled();

  if not app.is_staff_admin_of(p_commission) then
    raise exception 'você não pode gerenciar evidências nesta comissão'
      using errcode = '42501';
  end if;

  case p_kind
    when 'form' then
      return query
      select f.id, f.title, null::text
      from public.forms f
      where f.commission_id = p_commission
        and (v_q is null or f.title ilike '%' || v_q || '%')
      order by f.title
      limit 20;

    when 'form_version' then
      return query
      select fv.id, f.title || ' — v' || fv.version_number, fv.status
      from public.form_versions fv
      join public.forms f on f.id = fv.form_id
      where f.commission_id = p_commission
        and (v_q is null or f.title ilike '%' || v_q || '%')
      order by f.title, fv.version_number desc
      limit 20;

    when 'meeting' then
      return query
      select m.id, m.title, to_char(m.scheduled_start, 'DD/MM/YYYY')
      from public.meetings m
      where m.commission_id = p_commission
        and (v_q is null or m.title ilike '%' || v_q || '%')
      order by m.scheduled_start desc
      limit 20;

    when 'case' then
      return query
      select c.id, coalesce(c.label, 'Caso #' || c.case_number), null::text
      from public.cases c
      where c.commission_id = p_commission
        and app.can_read_case(c.id, v_uid)
        and (v_q is null or coalesce(c.label, '') ilike '%' || v_q || '%')
      order by c.case_number desc
      limit 20;

    when 'indicator' then
      return query
      select i.id, i.name, i.code
      from public.indicators i
      where i.commission_id = p_commission
        and (v_q is null or i.name ilike '%' || v_q || '%')
      order by i.name
      limit 20;

    when 'controlled_document' then
      return query
      select d.id, d.title, d.code
      from public.controlled_documents d
      where d.commission_id = p_commission
        and (v_q is null or d.title ilike '%' || v_q || '%')
      order by d.title
      limit 20;

    when 'action_item' then
      return query
      select ai.id, ai.title, null::text
      from public.action_items ai
      where ai.commission_id = p_commission
        and (v_q is null or ai.title ilike '%' || v_q || '%')
      order by ai.created_at desc
      limit 20;

    when 'capa_plan' then
      v_hospital := app.hospital_of_commission(p_commission);
      return query
      select cp.id, cp.code, null::text
      from public.capa_plan cp
      where cp.hospital_id = v_hospital
        and app.can_read_capa(cp.id, v_uid)
        and (v_q is null or cp.code ilike '%' || v_q || '%')
      order by cp.created_at desc
      limit 20;

    when 'charter' then
      return query
      select cc.commission_id, 'Regimento da comissão'::text, null::text
      from public.commission_charters cc
      where cc.commission_id = p_commission;

    when 'ethics_procedure' then
      return query
      select c.id, coalesce(c.label, 'Caso #' || c.case_number), null::text
      from public.cases c
      join public.ethics_case_details ecd on ecd.case_id = c.id
      where c.commission_id = p_commission
        and app.can_read_case(c.id, v_uid)
        and (v_q is null or coalesce(c.label, '') ilike '%' || v_q || '%')
      order by c.case_number desc
      limit 20;

    else
      raise exception 'evidence_candidates: unrecognized artifact_kind %', p_kind;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — same posture as Migration C: PostgreSQL grants EXECUTE to PUBLIC
-- on every new function by default, so each RPC is explicitly REVOKEd from
-- PUBLIC then GRANTed to authenticated only.
-- ---------------------------------------------------------------------------
revoke execute on function public.link_evidence(uuid, uuid, text, uuid, text) from public;
grant execute on function public.link_evidence(uuid, uuid, text, uuid, text) to authenticated;

revoke execute on function public.unlink_evidence(uuid) from public;
grant execute on function public.unlink_evidence(uuid) to authenticated;

revoke execute on function public.set_standard_assessment(uuid, uuid, text, text) from public;
grant execute on function public.set_standard_assessment(uuid, uuid, text, text) to authenticated;

revoke execute on function public.set_standard_ownership(uuid, uuid, uuid) from public;
grant execute on function public.set_standard_ownership(uuid, uuid, uuid) to authenticated;

revoke execute on function public.evidence_candidates(uuid, text, text) from public;
grant execute on function public.evidence_candidates(uuid, text, text) to authenticated;
