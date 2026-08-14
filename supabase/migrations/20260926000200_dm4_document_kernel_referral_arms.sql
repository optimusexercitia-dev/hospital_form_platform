-- =============================================================================
-- DM4 M2 — the document kernel + corridor gain their referral arms
-- (ADR 0119 D2/D6; two-tier asymmetry preserved on the new substrate).
--
-- Own migration because: this is the ENTIRE authz-arm diff of the phase — the
-- diff-scoped door sweep derives its worklist from exactly this file's four
-- prosecdef gates. All four are CREATE OR REPLACE over the catalog-read live
-- bodies (ACL-preserving — ADR 0116 #9 posture; asserted from proacl by the
-- keystones, never from this text).
--
-- The tiers, stated once: kernel read = can_read_referral_metadata (BROAD —
-- rows/titles; mirrors the retired referral_reply_attachment_select_readable);
-- byte corridor = can_read_referral_phi (NARROW — mirrors the retired
-- referral_attachments_obj_select). 340 B1+B10c pin BOTH halves so a collapse
-- in either direction goes red.
-- =============================================================================

-- 1. The Wave-C gate (mirrors app.assert_documents_wave_b_enabled, INVOKER).
create or replace function app.assert_documents_wave_c_enabled()
returns void
language plpgsql
as $$
begin
  if not app.feature_enabled('documents_wave_c') then
    raise exception 'os documentos de encaminhamento ainda não estão disponíveis'
      using errcode = 'HC0D7';
  end if;
end;
$$;
revoke all on function app.assert_documents_wave_c_enabled() from public;
grant execute on function app.assert_documents_wave_c_enabled() to authenticated, service_role;

-- 2. READ KERNEL: the case_referral arm dispatches to the referral metadata
--    tier. No admin arm (the noun rule — 340 B4). The D15 ceiling block below
--    is unreachable for this home (guard_document_confidentiality refuses
--    enforcing labels on non-case/interview homes), and its null-case
--    backstop fails closed if that ever changes.
create or replace function app.can_read_document(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
  v_conf text;
  v_case uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id, d.confidentiality_level
    into v_resource, v_type, v_commission, v_conf
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;
  if not (case v_type
    when 'case' then app.can_read_case(v_resource, p_uid)
    when 'meeting' then app.is_member_of_for(v_commission, p_uid)
    when 'interview' then app.can_read_interview(v_resource, p_uid)
    when 'action_item' then app.can_read_action_item(v_resource, p_uid)
    -- DM3 Wave B: the owning commission's members, PLUS the entitled approver
    -- corridor inherited from the retiring bucket policy. v_resource IS the
    -- controlled_documents.id (shared-PK registry link, ADR 0114 D4).
    when 'controlled_document' then
      app.is_member_of_for(v_commission, p_uid)
      or app.is_document_approver_of(v_resource, p_uid)
    -- DM4 Wave C: the referral METADATA tier (broad half of the two-tier
    -- asymmetry — ADR 0119 D2). Bytes are gated separately, and narrower,
    -- in open_document_version.
    when 'case_referral' then app.can_read_referral_metadata(v_resource, p_uid)
    else false
  end) then
    return false;
  end if;
  -- D15 ceiling (ADR 0114 Amendment 1; ADR 0072 D7 semantics): the two
  -- enforcing labels gate ABOVE home-resource read, as an AND-conjunct.
  -- Clearance = case_access_grants.max_confidentiality via the surviving
  -- app.confidentiality_clearance_ok (reused, never reimplemented).
  if v_conf in ('legal_privileged', 'credentialing_sensitive') then
    v_case := case v_type
      when 'case' then v_resource
      when 'interview' then app.case_of_interview(v_resource)
      else null
    end;
    if v_case is null then
      -- Fail-closed backstop: an enforcing label with no clearance plane is
      -- readable by NO ONE. Unrepresentable while the S1 seam guard stands;
      -- this arm governs any bypass and any future home type until the
      -- Phase-19 access plane (D16) absorbs the column. DM3 note: a
      -- controlled_document home lands HERE by design — Wave B documents can
      -- never carry an enforcing label, which is precisely why ethics letters
      -- home on the CASE resource instead (ADR 0114 Amendment 2). DM4 note:
      -- a case_referral home lands here too — and the FREEZE of an
      -- enforcing-labelled case document is refused outright (HC0DC,
      -- ADR 0119 D4), so the ceiling cannot be laundered through a referral.
      return false;
    end if;
    return app.confidentiality_clearance_ok(v_case, v_conf, p_uid);
  end if;
  return true;
end;
$$;

-- 3. WRITE KERNEL: the referral arm is the LEGACY reply-attachment authority,
--    verbatim in predicate terms (assert_referral_target_acts ≡
--    can_manage_referral_target + status window; catalog-verified): the
--    TARGET side — commission coordinator OR the DT office on a
--    technical_director-targeted referral — while accepted/in_review.
--    The SOURCE coordinator deliberately does NOT write here (340 B6b):
--    A shares through frozen snapshots of its own CASE documents.
create or replace function app.can_write_document(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id
    into v_resource, v_type, v_commission
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;
  case v_type
    when 'case' then
      if app.is_case_excluded(v_resource, p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'action_item' then
      if app.is_case_excluded(app.case_of_action_item(v_resource), p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or exists (select 1 from public.action_items ai
                     where ai.id = v_resource and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = v_resource and a.user_id = p_uid
                       and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(v_resource, p_uid);
    -- DM3 Wave B: writing a controlled document's files mirrors the authority
    -- the retiring `set_document_version_file` enforced (app.is_staff_admin_of
    -- on the owning commission). The APPROVER arm is deliberately absent here —
    -- an approver reads the artifact he reviews; he does not replace its bytes.
    when 'controlled_document' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    -- DM4 Wave C (ADR 0119 D6): reply attachments are B-side only, while the
    -- referral still accepts them — the legacy add_referral_reply_attachment
    -- window, preserved exactly.
    when 'case_referral' then
      return app.can_manage_referral_target(v_resource, p_uid)
         and exists (select 1 from public.case_referral r
                      where r.id = v_resource
                        and r.status in ('accepted', 'in_review'));
    else
      return false;
  end case;
end;
$$;

-- 4. BEGIN: the wave-c assert sits at the FIRST residue-producing step,
--    HOME-SCOPED (the DM3 QA MAJOR-1 lesson — a blanket assert would kill
--    Waves A/B; 340 B9c pins the scope). Tier: referral reply bytes are
--    PHI-tier, conservatively, like their retired bucket.
create or replace function public.begin_document_upload(
  p_resource_type text, p_resource_id uuid, p_title text,
  p_description text default null::text, p_confidentiality_level text default null::text,
  p_document_id uuid default null::uuid, p_declared_file_name text default null::text,
  p_declared_mime text default null::text, p_declared_size bigint default null::bigint,
  p_kind text default null::text, p_occurred_on date default null::date)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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
$$;

-- 5. THE byte corridor: referral-homed BYTES additionally require the PHI
--    tier — the narrow half of the asymmetry (mirrors the retired
--    referral_attachments_obj_select). Metadata reach (the kernel) stays
--    deliberately WIDER: a metadata reader keeps titles, never bytes.
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

  -- DM4 byte discrimination (ADR 0119 D2, same pattern one home over):
  -- referral-homed BYTES require the PHI tier; the kernel above already
  -- granted metadata. Same 42501 reasoning — existence is already disclosed.
  if v_res.resource_type = 'case_referral'
     and not app.can_read_referral_phi(v_doc.home_resource_id, v_uid) then
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
