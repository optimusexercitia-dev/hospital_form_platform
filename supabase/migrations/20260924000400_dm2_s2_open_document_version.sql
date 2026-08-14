-- =============================================================================
-- DM2·S2 — part 2 of 2: open_document_version, THE single byte corridor
-- (ADR 0114 D8/D10/D11; ADR 0118). Split from part 1 so its keystones were
-- observed RED (42883, door absent) before this file existed.
--
-- Returns IDS AND METADATA ONLY. The TS module resolves storage coordinates
-- with the service client AFTER this door authorizes, then signs short-TTL.
-- A direct PostgREST caller gets authorization semantics and nothing signable.
--
-- Order of gates (each keystoned): flag → active → existence → the KERNEL
-- (which carries the D15 ceiling; denial ≡ absence, one P0002) → document
-- status → binding present → file disposal → file upload state → THEN the
-- D11-floor audit row (gate-before-record: DM1 QA MINOR-2 discharged — the
-- registry path was removed in part 1; this internal write is the ONLY minter
-- of the document-open verb).
-- SQLSTATEs: HC0D8 not-servable · HC0DD disposal states (verified unused).
-- =============================================================================

create or replace function public.open_document_version(p_document_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_ver public.document_versions;
  v_doc public.documents;
  v_res public.securable_resources;
  v_file public.file_objects;
begin
  perform app.assert_documents_enabled();
  if v_uid is null or not app.is_active(v_uid) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select * into v_ver from public.document_versions where id = p_document_version_id;
  if v_ver.id is null then
    raise exception 'versão de documento não encontrada' using errcode = 'P0002';
  end if;
  select * into v_doc from public.documents where id = v_ver.document_id;

  -- THE kernel — home access AND the D15 ceiling. Denial is byte-identical to
  -- absence (oracle-kill), and NOTHING below runs for a denied caller: no
  -- audit row is minted for a denial (D11 floor: denials raise, never log).
  if not app.can_read_document(v_doc.id, v_uid) then
    raise exception 'versão de documento não encontrada' using errcode = 'P0002';
  end if;

  select * into v_res from public.securable_resources where id = v_doc.home_resource_id;

  if v_doc.status in ('disposal_pending', 'disposed') then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;
  if v_doc.status <> 'active' then
    raise exception 'documento indisponível' using errcode = 'HC0D8';
  end if;

  select f.* into v_file
    from public.document_version_files vf
    join public.file_objects f on f.id = vf.file_object_id
   where vf.document_version_id = v_ver.id and vf.rendition_kind = 'source'
   order by vf.created_at desc
   limit 1;
  if v_file.id is null then
    raise exception 'arquivo ainda não disponível' using errcode = 'HC0D8';
  end if;
  if v_file.disposal_state <> 'none' then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;
  if v_file.upload_state not in ('clean', 'unscanned_accepted') then
    raise exception 'arquivo indisponível para download' using errcode = 'HC0D8';
  end if;

  -- D11 floor, exactly: every PHI-tier open + every open by a non-creator.
  -- Same-user standard-tier opens are not logged; expansion is a product
  -- decision, not a default.
  if v_file.sensitivity_tier = 'phi' or v_uid <> v_doc.created_by then
    perform app.audit_write(
      'document.opened', 'document', v_doc.id, v_res.commission_id,
      'Documento aberto',
      jsonb_build_object('version_number', v_ver.version_number));
  end if;

  return jsonb_build_object(
    'document_id', v_doc.id,
    'document_version_id', v_ver.id,
    'version_number', v_ver.version_number,
    'title', v_doc.title,
    'mime_type', v_file.mime_type,
    'size_bytes', v_file.size_bytes,
    'sensitivity_tier', v_file.sensitivity_tier);
end;
$$;

revoke all on function public.open_document_version(uuid) from public, anon;
grant execute on function public.open_document_version(uuid) to authenticated, service_role;

-- Postcondition: the disposal SQLSTATE is unique to this body (keystone
-- crispness — §7.1): no OTHER routine may carry it.
do $do$
declare v_n int;
begin
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'HC0DD'
     and p.proname <> 'open_document_version';
  if v_n > 0 then
    raise exception 'S2 part 2 postcondition: HC0DD is not unique to the open door (% other bodies)', v_n;
  end if;
end $do$;
