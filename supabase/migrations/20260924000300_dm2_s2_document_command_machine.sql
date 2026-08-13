-- =============================================================================
-- DM2·S2 — the document command layer, part 1 of 2 (ADR 0114 D8/D9/D10/D11;
-- S2 decisions ADR 0118). Part 2 (20260924000400) is open_document_version
-- alone — split so its keystones red genuinely (42883) against a door-absent
-- catalog rather than against a deliberately defective intermediate.
--
-- Doors return IDS AND METADATA ONLY — never storage coordinates (deliberate
-- deviation from the ADR 0111/0113 composite shape, recorded in ADR 0118: a
-- direct PostgREST caller gets authorization semantics and nothing signable;
-- coordinates are resolved by the TS module with the service client).
--
-- Completion doors are SERVICE-ROLE-ONLY (authenticated EXECUTE absent): SQL
-- cannot hash Storage bytes, so D9's "verified server-side" verifier is the
-- service role. Actor identity on those paths comes from the SESSION row
-- (reserved_by), never a p_uid parameter (authz-handoff §7.17).
--
-- SQLSTATE block: HC0D7 module-off · HC0D9 upload-incomplete/machine errors ·
-- HC0DE session-expired · HC0DF file-too-large · HC0DG file-type · HC0DR
-- retention-blocked disposal. Distinct codes so the TS error-code union maps
-- on SQLSTATE alone (never message text) and each keystone pins its own code. (HC0D8 is reserved for part 2's not-servable
-- refusals; HC0D5 belongs to revoke_printed_document; HC0D6 to the S1 seam
-- guard; HC0DM to the DM1 parked seams.)
-- =============================================================================

-- ── 1 · the module flag gate ─────────────────────────────────────────────────
create or replace function app.assert_documents_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('documents_foundation') then
    raise exception 'o módulo de documentos não está disponível' using errcode = 'HC0D7';
  end if;
end;
$$;
revoke all on function app.assert_documents_enabled() from public;

-- ── 2 · FINDING 1(a): the registry loses its document arm ────────────────────
-- The open door (part 2) writes its own audit row internally, AFTER its own
-- gate. Leaving the registry arm in place would keep a SECOND minting path for
-- the same verb — one carrying the registry's pre-existing admin short-circuit
-- (DM1 QA MINOR-2) — reachable by any direct PostgREST caller. Removed, not
-- pinned: a public RPC arm cannot be "pinned unreachable".
-- M11-style replace() surgery: needle must match the live body exactly, land
-- exactly once, and the postcondition proves the arm is gone.

do $do$
declare
  v_old text;
  v_new text;
  v_needle text;
begin
  v_old := pg_get_functiondef('app._audit_access_authorized(text,uuid,uuid)'::regprocedure);
  v_needle :=
'    -- DM (ADR 0114 D11): the document-model read verb. The entity is the
    -- documents id; DM2''s open_document_version records PHI-tier and foreign
    -- opens through this registry. Replaces the ADR 0063 attachment-read arm
    -- removed by 20260923000100.
    when ''document.opened'' then
      return app.can_read_document(p_entity_id, v_uid);

';
  v_new := replace(v_old, v_needle, '');
  if v_new = v_old then
    raise exception 'S2 FINDING-1: the registry arm needle did not match — re-read the catalog';
  end if;
  if length(v_old) - length(v_new) <> length(v_needle) then
    raise exception 'S2 FINDING-1: more than one replacement landed in the registry dispatcher';
  end if;
  execute v_new;
end $do$;

do $do$
declare
  v_old text;
  v_new text;
  v_needle text;
begin
  v_old := pg_get_functiondef('public.log_audit_access(text,text,uuid,uuid,text,jsonb)'::regprocedure);
  v_needle :=
'    -- DM (ADR 0114 D11): the audited document open (replaces the ADR 0063
    -- attachment-read verb removed by 20260923000100). NO quoted dotted
    -- literal may appear in ANY comment of this body — pgTAP 191''s
    -- completeness parser reads every verb-shaped quoted string here,
    -- comments included.
    ''document.opened'',
';
  v_new := replace(v_old, v_needle, '');
  if v_new = v_old then
    raise exception 'S2 FINDING-1: the allowlist needle did not match — re-read the catalog';
  end if;
  if length(v_old) - length(v_new) <> length(v_needle) then
    raise exception 'S2 FINDING-1: more than one replacement landed in the access registry';
  end if;
  execute v_new;
end $do$;

-- Postconditions: the verb is dispatchable nowhere in the registry pair.
do $do$
begin
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = '_audit_access_authorized')
     ~ 'document\.opened' then
    raise exception 'S2 FINDING-1 postcondition: the dispatcher still carries the document arm';
  end if;
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'log_audit_access')
     ~ 'document\.opened' then
    raise exception 'S2 FINDING-1 postcondition: the access registry still allowlists the document verb';
  end if;
end $do$;

-- ── 3 · session → version linkage · the document's real-world date ───────────
alter table public.upload_sessions
  add column document_version_id uuid references public.document_versions(id) on delete cascade;

-- Contract amendment 2 (frontend review 2026-08-13): the F2 UI renders the
-- document's real-world date (an ata dated last month, uploaded today) —
-- distinct from created_at. Nullable; caller-supplied; not PHI (a date alone).
alter table public.documents
  add column occurred_on date;

comment on column public.upload_sessions.document_version_id is
  'The version this reservation uploads for. The binding (document_version_files) '
  'is created only at verified completion, so an in-flight upload is invisible to '
  'everyone but the reservation owner (K13 chain-only stands).';

-- ── 4 · begin_document_upload ────────────────────────────────────────────────
-- Authority: insert-then-check against the CANONICAL app.can_write_document
-- (atomic inside the DEFINER txn; a failed check rolls everything back). No
-- resource-keyed twin door is minted (ADR 0118 — one authority source).
create or replace function public.begin_document_upload(
  p_resource_type text,
  p_resource_id uuid,
  p_title text,
  p_description text default null,
  p_confidentiality_level text default null,
  p_document_id uuid default null,
  p_declared_file_name text default null,
  p_declared_mime text default null,
  p_declared_size bigint default null,
  p_kind text default null,
  p_occurred_on date default null
) returns jsonb
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
  -- caller input.
  v_tier := case when p_resource_type in ('case', 'interview') then 'phi' else 'standard' end;
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

-- ── 5 · finalize_document_upload (idempotent; server-derived size/MIME) ──────
create or replace function public.finalize_document_upload(p_upload_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.upload_sessions;
  v_f public.file_objects;
  v_size bigint;
  v_mime text;
begin
  perform app.assert_documents_enabled();
  if v_uid is null or not app.is_active(v_uid) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select * into v_s from public.upload_sessions
   where id = p_upload_session_id and reserved_by = v_uid
   for update;
  if v_s.id is null then
    raise exception 'sessão de upload não encontrada' using errcode = 'P0002';
  end if;

  select * into v_f from public.file_objects where id = v_s.file_object_id for update;

  if v_s.state = 'consumed' then
    -- Idempotent re-call: report the current state, mutate nothing.
    return jsonb_build_object(
      'upload_session_id', v_s.id,
      'file_object_id', v_f.id,
      'document_version_id', v_s.document_version_id,
      'upload_state', v_f.upload_state);
  end if;
  if v_s.state <> 'reserved' then
    raise exception 'sessão de upload cancelada ou expirada' using errcode = 'HC0D9';
  end if;
  if v_s.expires_at < now() then
    update public.upload_sessions set state = 'expired' where id = v_s.id;
    raise exception 'sessão de upload expirada' using errcode = 'HC0DE';
  end if;

  -- Server-derived facts: the object row Storage wrote on upload, never the
  -- caller's declared values (D9 / F-04).
  select (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
    into v_size, v_mime
    from storage.objects o
   where o.bucket_id = v_f.storage_bucket and o.name = v_f.storage_path;
  if v_size is null then
    raise exception 'objeto não encontrado no armazenamento (envio não concluído)'
      using errcode = 'HC0D9';
  end if;

  update public.file_objects
     set upload_state = 'uploaded', uploaded_at = now()
   where id = v_f.id;
  update public.file_objects
     set upload_state = 'verifying', size_bytes = v_size, mime_type = v_mime
   where id = v_f.id;
  update public.upload_sessions set state = 'consumed' where id = v_s.id;

  return jsonb_build_object(
    'upload_session_id', v_s.id,
    'file_object_id', v_f.id,
    'document_version_id', v_s.document_version_id,
    'upload_state', 'verifying');
end;
$$;

-- ── 6 · complete_document_upload_verification (SERVICE-ROLE ONLY) ────────────
-- The service role is D9's byte verifier (sha256 needs a byte read SQL cannot
-- do). Actor identity = the session's reserved_by; audit actor is NULL
-- (service call) with attribution in metadata — audit_log.actor_id is nullable
-- by design.
create or replace function public.complete_document_upload_verification(
  p_upload_session_id uuid,
  p_sha256 text,
  p_verified boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_s public.upload_sessions;
  v_f public.file_objects;
  v_doc uuid;
  v_commission uuid;
begin
  perform app.assert_documents_enabled();

  select * into v_s from public.upload_sessions
   where id = p_upload_session_id for update;
  if v_s.id is null or v_s.state <> 'consumed' then
    raise exception 'sessão de upload inválida para verificação' using errcode = 'HC0D9';
  end if;
  select * into v_f from public.file_objects where id = v_s.file_object_id for update;
  if v_f.upload_state <> 'verifying' then
    raise exception 'arquivo fora do estado de verificação' using errcode = 'HC0D9';
  end if;

  select dv.document_id into v_doc
    from public.document_versions dv where dv.id = v_s.document_version_id;
  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = v_doc;

  if not p_verified then
    update public.file_objects set upload_state = 'failed' where id = v_f.id;
    perform app.audit_write(
      'document.upload_failed', 'document', v_doc, v_commission,
      'Verificação do envio de documento falhou',
      jsonb_build_object('uploaded_by', v_s.reserved_by));
    return jsonb_build_object('upload_state', 'failed');
  end if;

  update public.file_objects
     set sha256 = p_sha256, verified_at = now(), upload_state = 'scan_pending'
   where id = v_f.id;
  -- D9 interim (O2 accepted): no scanner is integrated; user uploads enter the
  -- explicit auditable accepted state. Flipping to strict fail-closed is this
  -- one transition.
  update public.file_objects
     set upload_state = 'unscanned_accepted'
   where id = v_f.id;

  -- The binding lands only now — a never-verified upload never becomes
  -- servable, and stays invisible to everyone but its uploader's session.
  insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
  values (v_s.document_version_id, v_f.id, 'source');

  perform app.audit_write(
    'document.uploaded', 'document', v_doc, v_commission,
    'Documento enviado e verificado',
    jsonb_build_object('uploaded_by', v_s.reserved_by));

  return jsonb_build_object('upload_state', 'unscanned_accepted',
                            'document_id', v_doc,
                            'document_version_id', v_s.document_version_id);
end;
$$;

-- ── 7 · set_document_confidentiality (S1-O2: audited classification change) ──
create or replace function public.set_document_confidentiality(
  p_document_id uuid,
  p_level text
) returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  if not app.can_write_document(p_document_id, v_uid) then
    raise exception 'apenas a coordenação pode reclassificar este documento'
      using errcode = '42501';
  end if;
  select d.confidentiality_level, s.commission_id into v_old, v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = p_document_id;
  -- The S1 seam guard enforces vocabulary + the case/interview-only rule for
  -- enforcing labels (HC0D6); the column CHECK enforces the 7-value set.
  update public.documents set confidentiality_level = p_level where id = p_document_id;
  perform app.audit_write(
    'document.classification_changed', 'document', p_document_id, v_commission,
    'Nível de confidencialidade do documento alterado',
    jsonb_build_object('from', v_old, 'to', p_level));
end;
$$;

-- ── 8 · request_document_disposition (D10: reads fail closed immediately) ────
create or replace function public.request_document_disposition(
  p_document_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  if not app.can_write_document(p_document_id, v_uid) then
    raise exception 'apenas a coordenação pode solicitar o descarte deste documento'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.document_legal_holds h
              where h.document_id = p_document_id and h.released_at is null) then
    raise exception 'documento sob retenção legal — descarte bloqueado' using errcode = 'HC0D3';
  end if;
  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = p_document_id;

  -- Document level: reads of the aggregate fail closed at once.
  update public.documents set status = 'disposal_pending' where id = p_document_id;
  -- File level: every bound file of every version enters the disposal machine.
  update public.file_objects f
     set disposal_state = 'disposal_pending', disposal_reason_category = p_reason
   where f.disposal_state = 'none'
     and f.id in (select vf.file_object_id
                    from public.document_versions dv
                    join public.document_version_files vf on vf.document_version_id = dv.id
                   where dv.document_id = p_document_id);

  perform app.audit_write(
    'document.disposition_requested', 'document', p_document_id, v_commission,
    'Descarte de documento solicitado',
    jsonb_build_object('reason', p_reason));
end;
$$;

-- ── 9 · complete_document_disposal (SERVICE-ROLE ONLY; verify-absence) ───────
-- Retention gate (ADR 0116 §7 + FINDING 4): a provisional retention row
-- REFUSES disposal (HC0DR) — except (a) the Art. 18 lane (reason =
-- subject_request; blocking a statutory erasure on unratified values is the
-- worse failure — PO question surfaced, override audited) and (b) an UNBOUND
-- file (an orphaned physical copy is not the governance record).
create or replace function public.complete_document_disposal(p_file_object_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_f public.file_objects;
  v_bound boolean;
  v_doc uuid;
  v_commission uuid;
  v_provisional boolean;
begin
  perform app.assert_documents_enabled();
  select * into v_f from public.file_objects where id = p_file_object_id for update;
  if v_f.id is null or v_f.disposal_state <> 'disposal_pending' then
    raise exception 'arquivo não está aguardando descarte' using errcode = 'HC0D9';
  end if;

  select exists (select 1 from public.document_version_files vf
                  where vf.file_object_id = v_f.id) into v_bound;
  select dv.document_id into v_doc
    from public.document_version_files vf
    join public.document_versions dv on dv.id = vf.document_version_id
   where vf.file_object_id = v_f.id
   limit 1;
  if v_doc is not null then
    select s.commission_id into v_commission
      from public.documents d join public.securable_resources s on s.id = d.home_resource_id
     where d.id = v_doc;
  end if;

  select coalesce(bool_or(r.is_provisional), false) into v_provisional
    from public.document_retention r
   where (r.applies_to_tier is null or r.applies_to_tier = v_f.sensitivity_tier);

  if v_bound and v_provisional and v_f.disposal_reason_category <> 'subject_request' then
    raise exception 'política de retenção provisória — descarte bloqueado até ratificação'
      using errcode = 'HC0DR';
  end if;
  if v_bound and v_provisional and v_f.disposal_reason_category = 'subject_request' then
    perform app.audit_write(
      'document.retention_override', 'document', coalesce(v_doc, v_f.id), v_commission,
      'Descarte por solicitação do titular prosseguiu sob política de retenção provisória',
      jsonb_build_object('file_object_id', v_f.id));
  end if;

  -- Verify ABSENCE: the Storage-API delete must already have happened.
  if exists (select 1 from storage.objects o
              where o.bucket_id = v_f.storage_bucket and o.name = v_f.storage_path) then
    raise exception 'objeto ainda presente no armazenamento — descarte não confirmado'
      using errcode = 'HC0D9';
  end if;

  update public.file_objects
     set disposal_state = 'disposed', disposed_at = now()
   where id = v_f.id;

  -- Document closure: when every bound file is disposed, the document record
  -- minimises (D12: title/description redacted; governance skeleton survives).
  if v_doc is not null and not exists (
       select 1
         from public.document_versions dv
         join public.document_version_files vf on vf.document_version_id = dv.id
         join public.file_objects f on f.id = vf.file_object_id
        where dv.document_id = v_doc and f.disposal_state <> 'disposed') then
    update public.documents
       set status = 'disposed', deleted_at = coalesce(deleted_at, now()),
           title = '[removido]', description = null
     where id = v_doc;
    perform app.audit_write(
      'document.disposed', 'document', v_doc, v_commission,
      'Documento descartado (conteúdo removido, registro de governança preservado)',
      '{}'::jsonb);
  end if;
end;
$$;

-- ── 10 · legal holds ─────────────────────────────────────────────────────────
-- Authority = the hold audience (staff_admin-of-home OR tenancy admin), which
-- is exactly can_read_document_hold's decision — reused deliberately.
create or replace function public.place_document_hold(
  p_document_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  if not app.can_read_document_hold(p_document_id, v_uid) then
    raise exception 'sem permissão para gerenciar retenções legais deste documento'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('litigation', 'regulatory', 'audit', 'investigation', 'other') then
    raise exception 'motivo de retenção inválido' using errcode = 'check_violation';
  end if;
  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = p_document_id;
  if v_commission is null then
    raise exception 'documento não encontrado' using errcode = 'P0002';
  end if;
  insert into public.document_legal_holds (id, document_id, issued_by, reason_category, placed_at)
  values (v_id, p_document_id, v_uid, p_reason, now());
  perform app.audit_write(
    'document.hold_placed', 'document', p_document_id, v_commission,
    'Retenção legal aplicada ao documento',
    jsonb_build_object('reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.release_document_hold(p_hold_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_h public.document_legal_holds;
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  select * into v_h from public.document_legal_holds where id = p_hold_id for update;
  if v_h.id is null or not app.can_read_document_hold(v_h.document_id, v_uid) then
    raise exception 'retenção legal não encontrada' using errcode = 'P0002';
  end if;
  if v_h.released_at is not null then
    raise exception 'retenção legal já liberada' using errcode = 'check_violation';
  end if;
  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = v_h.document_id;
  update public.document_legal_holds
     set released_at = now(), released_by = v_uid
   where id = p_hold_id;
  perform app.audit_write(
    'document.hold_released', 'document', v_h.document_id, v_commission,
    'Retenção legal do documento liberada', '{}'::jsonb);
end;
$$;

-- ── 11 · soft_delete_document ────────────────────────────────────────────────
create or replace function public.soft_delete_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  if not app.can_write_document(p_document_id, v_uid) then
    raise exception 'apenas a coordenação pode remover este documento'
      using errcode = '42501';
  end if;
  if exists (select 1 from public.document_legal_holds h
              where h.document_id = p_document_id and h.released_at is null) then
    raise exception 'documento sob retenção legal — remoção bloqueada' using errcode = 'HC0D3';
  end if;
  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = p_document_id;
  update public.documents
     set status = 'soft_deleted', deleted_at = now()
   where id = p_document_id and status = 'active';
  perform app.audit_write(
    'document.soft_deleted', 'document', p_document_id, v_commission,
    'Documento removido (remoção reversível)', '{}'::jsonb);
end;
$$;

-- ── 12 · dispose_case_phi gains its document arm (FUP-DM1-DISPOSE) ───────────
-- Surgical replace of the (f) tombstone with the live arm; needle-match +
-- single-replacement + postcondition, per the M11 discipline.
do $do$
declare
  v_old text;
  v_new text;
  v_needle text;
  v_arm text;
begin
  v_old := pg_get_functiondef('public.dispose_case_phi(uuid,text)'::regprocedure);
  v_needle :=
'  -- (f) REMOVED — case_documents was folded into the F2 attachments substrate,
  --     and DM1 (ADR 0114/0116) dropped that substrate with zero rows carrying
  --     bytes. FUP-DM1-DISPOSE: when Wave A lands (DM2), this dispose must be
  --     wired to document disposition for case-homed documents (D10).';
  v_arm :=
'  -- (f) DM2·S2 (FUP-DM1-DISPOSE discharged): case-homed documents. Titles and
  --     descriptions redact (D12); every PHI-tier bound file enters the D10
  --     disposal machine with the caller''s reason (the Art. 18 lane when the
  --     reason is a subject request — see complete_document_disposal''s
  --     provisional-retention gate). Standard-tier files stay untouched.
  update public.documents d
     set title = v_redacted, description = null
   where d.home_resource_id = p_case_id;
  update public.file_objects f
     set disposal_state = ''disposal_pending'', disposal_reason_category = p_reason
   where f.disposal_state = ''none'' and f.sensitivity_tier = ''phi''
     and f.id in (
       select vf.file_object_id
         from public.documents d
         join public.document_versions dv on dv.document_id = d.id
         join public.document_version_files vf on vf.document_version_id = dv.id
        where d.home_resource_id = p_case_id);
  update public.documents d
     set status = ''disposal_pending''
   where d.home_resource_id = p_case_id and d.status = ''active''
     and exists (
       select 1 from public.document_versions dv
       join public.document_version_files vf on vf.document_version_id = dv.id
       join public.file_objects f on f.id = vf.file_object_id
      where dv.document_id = d.id and f.sensitivity_tier = ''phi'');';
  v_new := replace(v_old, v_needle, v_arm);
  if v_new = v_old then
    raise exception 'S2 dispose arm: the tombstone needle did not match — re-read the catalog';
  end if;
  execute v_new;
end $do$;

do $do$
begin
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'dispose_case_phi')
     !~ 'home_resource_id = p_case_id' then
    raise exception 'S2 dispose arm postcondition: the document arm did not land';
  end if;
end $do$;

-- ── 13 · ACLs ────────────────────────────────────────────────────────────────
-- User-facing doors: PUBLIC/anon revoked; authenticated + service_role EXECUTE.
revoke all on function public.begin_document_upload(text, uuid, text, text, text, uuid, text, text, bigint, text, date) from public, anon;
grant execute on function public.begin_document_upload(text, uuid, text, text, text, uuid, text, text, bigint, text, date) to authenticated, service_role;
revoke all on function public.finalize_document_upload(uuid) from public, anon;
grant execute on function public.finalize_document_upload(uuid) to authenticated, service_role;
revoke all on function public.set_document_confidentiality(uuid, text) from public, anon;
grant execute on function public.set_document_confidentiality(uuid, text) to authenticated, service_role;
revoke all on function public.request_document_disposition(uuid, text) from public, anon;
grant execute on function public.request_document_disposition(uuid, text) to authenticated, service_role;
revoke all on function public.place_document_hold(uuid, text) from public, anon;
grant execute on function public.place_document_hold(uuid, text) to authenticated, service_role;
revoke all on function public.release_document_hold(uuid) from public, anon;
grant execute on function public.release_document_hold(uuid) to authenticated, service_role;
revoke all on function public.soft_delete_document(uuid) from public, anon;
grant execute on function public.soft_delete_document(uuid) to authenticated, service_role;
-- Completion doors: SERVICE-ROLE ONLY (authenticated deliberately absent).
revoke all on function public.complete_document_upload_verification(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.complete_document_upload_verification(uuid, text, boolean) to service_role;
revoke all on function public.complete_document_disposal(uuid) from public, anon, authenticated;
grant execute on function public.complete_document_disposal(uuid) to service_role;
