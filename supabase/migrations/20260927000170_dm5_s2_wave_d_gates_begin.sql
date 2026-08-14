-- =============================================================================
-- DM5 S2 · M8 (P0) — `documents_wave_d` gates begin_document_upload for the
-- `rca` / `capa_action` homes.
--
-- ⛔ THE DEFECT. 20260927000150 put the wave_d assert in the `document` ARM of
-- add_rca_evidence / add_capa_action_evidence — the LAST step of the corridor.
-- `begin_document_upload` carried wave_b and wave_c arms and NO wave_d. So with
-- the flag OFF a caller could still create the document, reserve a path, **PUT
-- REAL BYTES**, and finalize; only the final evidence write refused — leaving
-- ORPHANED BYTES and an orphaned document/version behind a flag that is
-- supposed to make the corridor unreachable.
--
-- ⭐ This is DM3 QA MAJOR-1 reproduced one wave over, and DM3 treated it as
-- blocking. The precedent was sitting INSIDE THE SAME FUNCTION: Waves B and C
-- each put their assert at exactly the step Wave D skipped. The flag must gate
-- the corridor at its FIRST residue-producing step, not its last.
--
-- ⚠ HOME-TYPE-SCOPED, NEVER BLANKET. `begin_document_upload` serves every home.
-- A blanket assert here would refuse Waves A/B/C at the shared door — the
-- DM3·T3b shape. 341 pins BOTH halves: with wave_d OFF an `rca` home is refused
-- AND a `case` home still succeeds. One half alone passes while silently
-- killing the earlier waves.
-- =============================================================================

begin;

CREATE OR REPLACE FUNCTION public.begin_document_upload(p_resource_type text, p_resource_id uuid, p_title text, p_description text DEFAULT NULL::text, p_confidentiality_level text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid, p_declared_file_name text DEFAULT NULL::text, p_declared_mime text DEFAULT NULL::text, p_declared_size bigint DEFAULT NULL::bigint, p_kind text DEFAULT NULL::text, p_occurred_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_res public.securable_resources;
  v_tier text;
  v_bucket text;
  v_doc_id uuid;
  v_version_no int;
  v_version_id uuid := gen_random_uuid();
  v_file_id uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_cap bigint;
  v_mimes text[];
begin
  perform app.assert_documents_enabled();
  -- DM3 QA MAJOR-1: Wave B's flag gates the corridor at its FIRST
  -- residue-producing step. Scoped to the home type so Wave A is untouched.
  if p_resource_type = 'controlled_document' then
    perform app.assert_documents_wave_b_enabled();
  end if;
  -- DM4: same rule, Wave C's flag, same scoping (ADR 0119 D6).
  if p_resource_type = 'case_referral' then
    perform app.assert_documents_wave_c_enabled();
  end if;

  -- DM5 S2 M8: the FIRST residue-producing step for the NSP evidence corridor.
  -- Home-type-scoped, mirroring the wave_b / wave_c arms directly above.
  if p_resource_type in ('rca', 'capa_action') then
    perform app.assert_documents_wave_d_enabled();
  end if;
  if v_uid is null or not app.is_active(v_uid) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select * into v_res from public.securable_resources s
   where s.id = p_resource_id and s.resource_type = p_resource_type;
  if v_res.id is null then
    -- absence ≡ denial (oracle-kill): same error as the authority failure below
    raise exception 'recurso não encontrado' using errcode = 'P0002';
  end if;

  -- Tier is SERVER-derived (ADR 0118): the two Class-1 PHI module homes take
  -- the phi bucket conservatively; meeting/action_item take standard. Never a
  -- caller input. DM4: case_referral joins the phi set — reply attachments
  -- are Rule-12 referral PHI, like the retired referral-attachments bucket.
  v_tier := case when p_resource_type in ('case', 'interview', 'case_referral')
                 then 'phi' else 'standard' end;
  v_bucket := case v_tier when 'phi' then 'documents-phi' else 'documents-standard' end;

  -- Declared hints validated against the bucket caps (the REAL enforcement is
  -- the storage policy + finalize's server-derived values — D9).
  select b.file_size_limit, b.allowed_mime_types into v_cap, v_mimes
    from storage.buckets b where b.id = v_bucket;
  if p_declared_size is not null and p_declared_size > v_cap then
    raise exception 'arquivo excede o tamanho máximo permitido' using errcode = 'HC0DF';
  end if;
  if p_declared_mime is not null and not (p_declared_mime = any (v_mimes)) then
    raise exception 'tipo de arquivo não permitido' using errcode = 'HC0DG';
  end if;

  if p_document_id is null then
    v_doc_id := gen_random_uuid();
    -- The S1 seam guard validates the label here (HC0D6 for an enforcing label
    -- on a meeting/action_item home).
    -- kind is UNCHECKED text in the DB (no CHECK constraint, deliberately —
    -- the closed per-home vocabulary is product/UI surface, exported from the
    -- TS contract; a SQL CHECK would take a migration per vocabulary change).
    insert into public.documents (id, home_resource_id, title, description, kind,
                                  occurred_on, status, confidentiality_level, created_by)
    values (v_doc_id, p_resource_id, p_title, p_description, p_kind,
            p_occurred_on, 'active', p_confidentiality_level, v_uid);
    v_version_no := 1;
  else
    v_doc_id := p_document_id;
    perform 1 from public.documents d
      where d.id = v_doc_id and d.home_resource_id = p_resource_id
      for update;                         -- serializes version numbering
    if not found then
      raise exception 'recurso não encontrado' using errcode = 'P0002';
    end if;
    select coalesce(max(dv.version_number), 0) + 1 into v_version_no
      from public.document_versions dv where dv.document_id = v_doc_id;
  end if;

  -- THE authority check (canonical door; insert-then-check is atomic).
  if not app.can_write_document(v_doc_id, v_uid) then
    raise exception 'recurso não encontrado' using errcode = 'P0002';
  end if;

  insert into public.document_versions (id, document_id, version_number, created_by)
  values (v_version_id, v_doc_id, v_version_no, v_uid);

  insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
  values (v_file_id, v_bucket,
          v_res.organization_id::text || '/' || v_file_id::text || '/' || gen_random_uuid()::text,
          v_tier, v_uid);

  insert into public.upload_sessions (id, file_object_id, document_version_id, reserved_by, expires_at)
  values (v_session_id, v_file_id, v_version_id, v_uid, now() + interval '15 minutes');

  perform app.audit_write(
    'document.upload_started', 'document', v_doc_id, v_res.commission_id,
    'Envio de documento iniciado',
    jsonb_build_object('version_number', v_version_no));

  return jsonb_build_object(
    'upload_session_id', v_session_id,
    'document_id', v_doc_id,
    'document_version_id', v_version_id,
    'file_object_id', v_file_id,
    'expires_at', (now() + interval '15 minutes'));
end;
$function$;

do $$
declare v_src text; v_raw aclitem[]; v_acl text;
begin
  select p.prosrc, p.proacl, array_to_string(p.proacl, ',') into v_src, v_raw, v_acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'begin_document_upload';

  if v_src !~ 'assert_documents_wave_d_enabled' then
    raise exception 'the wave_d assert is missing from begin_document_upload';
  end if;
  -- NOT BLANKET: it must sit inside a resource_type test, and the wave_b/wave_c
  -- arms must survive untouched.
  if v_src !~ 'p_resource_type in \(''rca'', ''capa_action''\)' then
    raise exception 'the wave_d assert is not home-type-scoped';
  end if;
  if v_src !~ 'assert_documents_wave_b_enabled' or v_src !~ 'assert_documents_wave_c_enabled' then
    raise exception 'the wave_b/wave_c arms did not survive the rebuild';
  end if;
  if not exists (select 1 from aclexplode(v_raw) a
                  where a.grantee = 'authenticated'::regrole::oid and a.privilege_type = 'EXECUTE') then
    raise exception 'begin_document_upload lost the authenticated EXECUTE grant (got %)', v_acl;
  end if;
  if exists (select 1 from aclexplode(v_raw) a where a.grantee = 0) then
    raise exception 'begin_document_upload gained a PUBLIC grant (got %)', v_acl;
  end if;
end $$;

commit;
