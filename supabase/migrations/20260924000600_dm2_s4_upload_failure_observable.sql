-- =============================================================================
-- DM2·S4 routed bugs (lead-confirmed from the catalog, 2026-08-13).
--
-- BUG-DM2-001 (MAJOR): the p_verified=false branch marked the FILE failed but
-- never bound it, and the projection derives availability from the BOUND
-- file — so a dead upload rendered "Processando envio" (pending) forever.
-- The door's own pin was green because it asserted the column, never what the
-- READER sees. Fix: the failure BINDS too — the failed file becomes part of
-- the version's record, the chain makes it reader-observable, and the
-- projection derives `failed`. Retry safety (lead flag, verified): every
-- retry mints a NEW version via begin_document_upload, so the failure
-- binding cannot collide with UNIQUE(document_version_id, rendition_kind);
-- re-verification of a failed file stays refused (state 'failed' ≠
-- 'verifying').
--
-- BUG-DM2-003 (MINOR): finalize's expired-marking UPDATE was unconditionally
-- rolled back by its own RAISE (one RPC call = one transaction) — a
-- state-column lie. Removed: the refusal is and stays PREDICATE-based
-- (expires_at < now()); expiry MARKING belongs to reconciliation's sweep,
-- which runs in its own transaction and exists to sweep exactly this.
-- =============================================================================

do $do$
declare v_src text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_document_upload_verification';
  if v_src is null or v_src !~ '''failed''' then
    raise exception 'S4 BUG-001: completion door drifted — re-derive from the catalog';
  end if;
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'finalize_document_upload';
  if v_src is null or v_src !~ 'state = ''expired''' then
    raise exception 'S4 BUG-003: finalize drifted (no dead expired-UPDATE found) — re-derive';
  end if;
end $do$;

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
    -- BUG-DM2-001: the failure BINDS — it becomes part of the version's
    -- record, so the reader-facing projection derives `failed` instead of an
    -- eternal `pending`. A retry mints a NEW version (begin), so this binding
    -- never collides with UNIQUE(version, rendition).
    insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
    values (v_s.document_version_id, v_f.id, 'source');
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
    -- BUG-DM2-003: no state write here — a refusal that must also persist
    -- state fights its own transaction (the RAISE rolls it back). The refusal
    -- is PREDICATE-based and total; expiry MARKING is reconciliation's sweep.
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

-- Postconditions: the failure binds; the dead expired-UPDATE is gone; both
-- doors kept DEFINER + pinned path + their ACL posture (CREATE OR REPLACE
-- preserves ACLs; asserted anyway — the rebuild-loses-properties class).
do $do$
declare v_src text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_document_upload_verification'
     and p.prosecdef;
  if v_src is null then
    raise exception 'S4 postcondition: completion door missing or lost DEFINER';
  end if;
  if v_src !~ 'if not p_verified then[^$]*insert into public\.document_version_files' then
    raise exception 'S4 postcondition: the failure branch does not bind';
  end if;
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'finalize_document_upload' and p.prosecdef;
  if v_src is null or v_src ~ 'state = ''expired''' then
    raise exception 'S4 postcondition: the dead expired-UPDATE survived (or finalize lost DEFINER)';
  end if;
  if not exists (
    select 1 from information_schema.role_routine_grants g
     where g.routine_schema = 'public'
       and g.routine_name = 'complete_document_upload_verification'
       and g.grantee = 'service_role')
     or exists (
    select 1 from information_schema.role_routine_grants g
     where g.routine_schema = 'public'
       and g.routine_name = 'complete_document_upload_verification'
       and g.grantee in ('authenticated', 'anon')) then
    raise exception 'S4 postcondition: completion-door ACL drifted from service-role-only';
  end if;
end $do$;
