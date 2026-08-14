-- =============================================================================
-- DM5 S2 · M6 — `documents_wave_d` gates the NSP evidence corridor,
-- HOME/ARM-SCOPED at the FIRST residue-producing step (ADR 0120 D10).
--
-- ⭐ WHY THE ASSERT IS INSIDE THE `document` ARM AND NOT AT THE TOP.
-- `add_rca_evidence` serves THREE kinds and `add_capa_action_evidence` TWO.
-- Only the `document` kind touches the new substrate; `link` and `citation`
-- are pre-existing NSP features with no bytes and no document binding. A
-- blanket assert at the head of either function would SATISFY the refusal
-- keystone while silently killing arms that have nothing to do with Wave D —
-- the DM3 `DM3·T3b` shape exactly, where the same mistake would have killed
-- Wave A with Wave B's flag. 341's positive control is what tells those two
-- apart; a refusal test alone cannot.
--
-- ⚠ The flag is a ROLLOUT control, not an authorization control, and it lives
-- in the RPC body ON PURPOSE. Both evidence tables carry table-wide `arwdDxtm`
-- to `authenticated` (FUP-DM5-GRANTS), so direct PostgREST DML never traverses
-- these functions and the flag does not bind there. That is ACCEPTABLE for a
-- rollout gate and would NOT be for an invariant — which is why the shape rules
-- from 20260927000120 are CHECKs and this is an assert.
--
-- The assert function pins its `search_path`, unlike its sibling
-- `app.assert_documents_wave_c_enabled`, which does not. Matching the better of
-- the two deliberately rather than the nearest.
--
-- Production default stays OFF (20260923000600); the seed forces it ON for
-- local/E2E in the same edit as `328` K9b/K9c — that coupling is what K9 exists
-- to force, and a flag flipped without the keystone count moving reds 328.
-- =============================================================================

begin;

create or replace function app.assert_documents_wave_d_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('documents_wave_d') then
    raise exception 'os arquivos de evidência ainda não estão disponíveis'
      using errcode = 'HC0D7';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.add_rca_evidence(p_rca_id uuid, p_kind text, p_title text, p_document_id uuid DEFAULT NULL::uuid, p_external_url text DEFAULT NULL::text, p_citation_target text DEFAULT NULL::text, p_cited_entity_id uuid DEFAULT NULL::uuid, p_citation_label text DEFAULT NULL::text)
 RETURNS rca_evidence
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row public.rca_evidence;
  v_interview uuid;
  v_meeting uuid;
  v_document uuid;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;
  if p_kind not in ('document', 'link', 'citation') then
    raise exception 'tipo de evidência inválido' using errcode = 'check_violation';
  end if;

  if p_kind = 'document' then
    -- D10: FIRST residue-producing step, `document` ARM ONLY (never blanket).
    perform app.assert_documents_wave_d_enabled();
    if p_document_id is null or p_external_url is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if not exists (
      select 1
        from public.documents d
        join public.securable_resources s on s.id = d.home_resource_id
       where d.id = p_document_id
         and s.resource_type = 'rca'
         and d.home_resource_id = p_rca_id
         and d.status = 'active'
    ) then
      raise exception 'documento indisponível para esta análise' using errcode = 'HC0D8';
    end if;
  elsif p_kind = 'link' then
    if p_external_url is null or p_document_id is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if p_external_url not like 'https://%' then
      raise exception 'o link deve começar com https://' using errcode = 'check_violation';
    end if;
  else -- citation
    if p_citation_target not in ('interview', 'meeting', 'document')
       or p_cited_entity_id is null or p_document_id is not null or p_external_url is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if btrim(coalesce(p_citation_label, '')) = '' then
      raise exception 'informe um rótulo para a citação' using errcode = 'check_violation';
    end if;
    -- DM5 S2: the document citation arm is LIVE. It replaces the HC0DM refusal
    -- with an authorization gate — you may only cite what you may READ.
    if p_citation_target = 'document'
       and not app.can_read_document(p_cited_entity_id, auth.uid()) then
      raise exception 'documento indisponível para citação' using errcode = 'HC0D8';
    end if;
    if p_citation_target = 'interview' then v_interview := p_cited_entity_id;
    elsif p_citation_target = 'meeting' then v_meeting := p_cited_entity_id;
    else v_document := p_cited_entity_id;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_evidence (
    rca_id, kind, title, document_id, external_url,
    cited_interview_id, cited_meeting_id, cited_document_id, citation_label, created_by
  ) values (
    p_rca_id, p_kind, btrim(p_title),
    case when p_kind = 'document' then p_document_id else null end,
    p_external_url,
    v_interview, v_meeting, v_document,
    case when p_kind = 'citation' then btrim(p_citation_label) else null end,
    auth.uid()
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_capa_action_evidence(p_action_id uuid, p_kind text, p_title text, p_document_id uuid DEFAULT NULL::uuid, p_external_url text DEFAULT NULL::text)
 RETURNS capa_action_evidence
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row public.capa_action_evidence;
  v_capa uuid;
begin
  perform app.assert_patient_safety_enabled();
  select ca.capa_id into v_capa from public.capa_action ca where ca.id = p_action_id;
  if v_capa is null then
    raise exception 'ação não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa);

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;
  if p_kind not in ('document', 'link') then
    raise exception 'tipo de evidência inválido' using errcode = 'check_violation';
  end if;

  if p_kind = 'document' then
    -- D10: FIRST residue-producing step, `document` ARM ONLY (never blanket).
    perform app.assert_documents_wave_d_enabled();
    if p_document_id is null or p_external_url is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo ou link'
        using errcode = 'check_violation';
    end if;
    -- Homed on THIS capa_action (the D14 securable type), same denial shape.
    if not exists (
      select 1
        from public.documents d
        join public.securable_resources s on s.id = d.home_resource_id
       where d.id = p_document_id
         and s.resource_type = 'capa_action'
         and d.home_resource_id = p_action_id
         and d.status = 'active'
    ) then
      raise exception 'documento indisponível para esta ação' using errcode = 'HC0D8';
    end if;
  else
    if p_external_url is null or p_document_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo ou link'
        using errcode = 'check_violation';
    end if;
    if p_external_url not like 'https://%' then
      raise exception 'o link deve começar com https://' using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  insert into public.capa_action_evidence (
    action_id, kind, title, document_id, external_url, created_by
  ) values (
    p_action_id, p_kind, btrim(p_title),
    case when p_kind = 'document' then p_document_id else null end,
    p_external_url, auth.uid()
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$function$
;

-- Post-conditions from the catalog. The BLANKET check is the load-bearing one:
-- the assert must appear AFTER the `document` branch opens, never before the
-- kind dispatch, or the link/citation arms die with the flag.
do $$
declare
  r record;
begin
  for r in
    select p.proname, p.prosrc, array_to_string(p.proacl, ',') acl, p.proacl raw_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('add_rca_evidence', 'add_capa_action_evidence')
  loop
    if position('assert_documents_wave_d_enabled' in r.prosrc) = 0 then
      raise exception '%: the wave_d assert is missing', r.proname;
    end if;
    if position('assert_documents_wave_d_enabled' in r.prosrc)
       < position('if p_kind = ''document'' then' in r.prosrc) then
      raise exception '%: the wave_d assert is BLANKET — it precedes the kind dispatch', r.proname;
    end if;
    if r.acl not like '%authenticated=X/postgres%' then
      raise exception '%: lost the authenticated EXECUTE grant', r.proname;
    end if;
    -- ⚠ PUBLIC is an aclitem with an EMPTY GRANTEE, so a SUBSTRING test cannot
    -- see it: `acl like '%=X/postgres%'` also matches `postgres=X/postgres`.
    -- The first version of this fired on EVERY function (false positive, broke
    -- the reset); the variant guarded with `and not like '%postgres=X/postgres%'`
    -- could NEVER fire while postgres held a grant (vacuous, false negative).
    -- Both wrong, in opposite directions. aclexplode gives the structural answer:
    -- grantee = 0 IS PUBLIC.
    if exists (select 1 from aclexplode(r.raw_acl) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception '%: PUBLIC holds EXECUTE after the rebuild (got %)', r.proname, r.acl;
    end if;
  end loop;
end $$;

commit;
