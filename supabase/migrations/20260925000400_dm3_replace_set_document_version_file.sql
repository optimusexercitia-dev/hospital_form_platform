-- =============================================================================
-- DM3 · M4 — the raw-path write path ends. `set_document_version_file` and
-- `controlled_document_versions.storage_path` are replaced by the DM2
-- begin/finalize pair plus a thin domain door that records the pointer.
--
-- ADR 0114 D8/D13; plan §3 M4. Bytes now arrive ONLY through
-- begin_document_upload(p_resource_type := 'controlled_document') →
-- finalize_document_upload; the domain never sees a bucket or a path.
--
-- ⚠ TWO LIVE BEHAVIOURS GATE ON THE COLUMN AND MOVE WITH IT. Found by sweeping
-- pg_proc.prosrc for `storage_path` ∧ `controlled_document` (three hits: the
-- doomed writer plus these two). A column drop does NOT fail a function that
-- references it — the breakage would have surfaced at runtime, so these are
-- re-expressed HERE rather than left to M8:
--
--   1. `submit_document_for_approval` refuses when the version has no file
--      ('anexe o arquivo do documento antes de enviar para aprovação', HC089).
--      A REAL precondition — without re-expressing it, a version could be sent
--      for approval with nothing attached.
--   2. `app.decide_document_approval_core` computes the per-signer e-signature
--      hash over the storage path, whose own comment explains the choice:
--      "storage_path is immutable (Rule 6) so it stably identifies the signed
--      bytes." That property must survive.
--
-- ⚠ E-SIGNATURE BASIS — a deliberate, conservative choice, recorded so it is not
-- re-litigated blind. The hash keeps binding to an IMMUTABLE STORAGE PATH,
-- resolved through the new pointer instead of read off the domain row. The
-- available alternative is `file_objects.sha256` — the server-VERIFIED content
-- hash, strictly better provenance — but switching the basis of an existing
-- e-signature scheme (ADR 0057) is a semantic change to a signing artifact, not
-- a refactor, and it is not DM3's to make unilaterally. Filed for the lead/PO as
-- FUP-DM3-SIGBASIS. Semantics here are preserved EXACTLY.
-- =============================================================================

-- --- Wave B gate --------------------------------------------------------------
create or replace function app.assert_documents_wave_b_enabled()
 returns void
 language plpgsql
 stable
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if not app.feature_enabled('documents_wave_b') then
    raise exception 'o novo modelo de arquivos de documentos controlados não está disponível'
      using errcode = 'HC0D7';
  end if;
end;
$function$;

revoke all on function app.assert_documents_wave_b_enabled() from public;
grant execute on function app.assert_documents_wave_b_enabled() to authenticated, service_role;

-- --- the ONE place that resolves a controlled version's signed bytes ---------
-- Both the e-signature hash and the has-a-file precondition go through here, so
-- the "what identifies the signed bytes" decision lives in exactly one body.
create or replace function app.controlled_version_source_path(p_version_id uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select f.storage_path
    from public.controlled_document_versions v
    join public.document_version_files dvf
      on dvf.document_version_id = v.core_document_version_id
     and dvf.rendition_kind = 'source'
    join public.file_objects f on f.id = dvf.file_object_id
   where v.id = p_version_id;
$function$;

revoke all on function app.controlled_version_source_path(uuid) from public;
grant execute on function app.controlled_version_source_path(uuid) to authenticated, service_role;

-- --- the replacement door -----------------------------------------------------
create or replace function public.attach_controlled_document_version_file(
  p_version_id uuid,
  p_core_version_id uuid,
  p_summary_of_changes_md text default null,
  p_expiry_date date default null)
 returns public.controlled_document_versions
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.controlled_document_versions;
  v_commission uuid;
  v_status text;
begin
  perform app.assert_controlled_docs_enabled();
  perform app.assert_documents_wave_b_enabled();

  select d.commission_id, v.status into v_commission, v_status
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_commission is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;

  -- THE DOOR's freeze re-check. Deliberately a DIFFERENT errcode from the
  -- trigger's HC0DB so a red is attributable to ONE barrier (R2): this is the
  -- door half, app.guard_controlled_core_binding is the substrate half, and
  -- DM3·P1 / DM3·P2 neutralize them independently.
  if v_status not in ('draft', 'changes_requested') then
    raise exception 'apenas versões em rascunho ou com alterações solicitadas podem ter o arquivo alterado'
      using errcode = 'HC089';
  end if;

  update public.controlled_document_versions
  set core_document_version_id = p_core_version_id,
      summary_of_changes_md = coalesce(nullif(btrim(p_summary_of_changes_md), ''), summary_of_changes_md),
      expiry_date = coalesce(p_expiry_date, expiry_date)
  where id = p_version_id
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.attach_controlled_document_version_file(uuid, uuid, text, date) from public;
grant execute on function public.attach_controlled_document_version_file(uuid, uuid, text, date)
  to authenticated, service_role;

-- --- re-express the two gating behaviours BEFORE the column disappears --------
do $rewrite$
declare src text;
begin
  -- (1) the has-a-file precondition
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'submit_document_for_approval';
  src := replace(src,
    'select d.commission_id, v.status, v.storage_path, d.code, d.title',
    'select d.commission_id, v.status, app.controlled_version_source_path(v.id), d.code, d.title');
  if src !~ 'controlled_version_source_path' then
    raise exception 'M4: submit_document_for_approval rewrite anchor drifted — refusing to drop the column';
  end if;
  execute src;

  -- (2) the e-signature hash basis
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'decide_document_approval_core';
  src := replace(src,
    'select v.status, v.storage_path, v.document_id, d.commission_id, d.code, d.title, d.created_by',
    'select v.status, app.controlled_version_source_path(v.id), v.document_id, d.commission_id, d.code, d.title, d.created_by');
  if src !~ 'controlled_version_source_path' then
    raise exception 'M4: decide_document_approval_core rewrite anchor drifted — refusing to drop the column';
  end if;
  execute src;
end $rewrite$;

-- --- retire the raw-path surface ---------------------------------------------
drop function public.set_document_version_file(uuid, text, text, date);

alter table public.controlled_document_versions drop column storage_path;

comment on function public.attach_controlled_document_version_file(uuid, uuid, text, date) is
  'Records which core document_version carries this controlled-document '
  'version''s file. Bytes arrive only via begin_document_upload/'
  'finalize_document_upload; no bucket or path crosses this boundary '
  '(ADR 0118 §1). Replaces set_document_version_file (DM3 M4).';
