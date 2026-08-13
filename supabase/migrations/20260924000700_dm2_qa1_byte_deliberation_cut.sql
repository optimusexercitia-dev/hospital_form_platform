-- =============================================================================
-- DM2 · QA r1 P0-1 — the QO·B byte-discrimination cut, re-expressed in the
-- byte corridor (ADR 0118 §12; the 308 §5.2–5.7 obligation; QA review
-- docs/reviews/dm2-orchestration-wave-a-review.md).
--
-- THE DEFECT: `app.can_read_document`'s case arm is bare `can_read_case`
-- (= read_case_content — exactly the bit S7 confers on the oversight quality
-- reviewer), and `open_document_version` carried no byte discrimination of
-- its own. The reviewer was SERVED phi bytes; the only shipped control was a
-- React prop (Architecture Rule 1 inverted).
--
-- THE FIX, in the DOOR and not the kernel — the reasoning the lead asked for:
-- the kernel governs METADATA visibility, and the M8 half of the QO·B
-- contract is that the reviewer KEEPS titles (pinned by 308 5.1 and 329 P0e).
-- A kernel conjunct would over-narrow in exactly the direction M8 forbids.
-- The M9 predecessor put the cut inside the byte door (`open_attachment`,
-- 20260911000800: "case/interview bytes require read_case_deliberation —
-- conferred by every content source EXCEPT the S7 arm"); this door inherits
-- that contract verbatim. Metadata YES, bytes NO.
-- =============================================================================

do $do$
declare v_src text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_document_version';
  if v_src is null or v_src ~ 'read_case_deliberation' then
    raise exception 'P0-1: open_document_version drifted (missing, or the conjunct already present) — re-derive';
  end if;
  if v_src !~ 'can_read_document' then
    raise exception 'P0-1: the door no longer routes the kernel — re-derive from the catalog';
  end if;
end $do$;

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
  v_case uuid;
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

  -- QO·B byte discrimination (P0-1; the M9 contract re-expressed): case- and
  -- interview-homed BYTES additionally require read_case_deliberation —
  -- conferred by every content source EXCEPT the S7 oversight arm. Metadata
  -- reach (the kernel, above) is deliberately WIDER: the reviewer keeps
  -- titles (M8), never bytes (M9). A distinct error is safe here — metadata
  -- visibility already discloses existence to every kernel-passing caller.
  v_case := case v_res.resource_type
    when 'case' then v_doc.home_resource_id
    when 'interview' then app.case_of_interview(v_doc.home_resource_id)
    else null
  end;
  if v_case is not null
     and not app.has_case_capability(v_case, v_uid, 'read_case_deliberation') then
    raise exception 'sem autorização para baixar este documento' using errcode = '42501';
  end if;

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

-- Postconditions (mirroring M9's own resolve-shape pin): the conjunct is in
-- the live body; DEFINER + pinned path + ACL survived the re-emit.
do $do$
declare v_src text; v_acl text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), p.proacl::text into v_src, v_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_document_version' and p.prosecdef;
  if v_src is null or v_src !~ 'read_case_deliberation' then
    raise exception 'P0-1 postcondition: the deliberation conjunct did not land (or DEFINER lost)';
  end if;
  if v_acl !~ 'authenticated=X' then
    raise exception 'P0-1 postcondition: the door ACL drifted: %', v_acl;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'open_document_version'
       and p.proconfig::text ~ 'search_path=app, public, pg_catalog') then
    raise exception 'P0-1 postcondition: pinned search_path lost';
  end if;
end $do$;
