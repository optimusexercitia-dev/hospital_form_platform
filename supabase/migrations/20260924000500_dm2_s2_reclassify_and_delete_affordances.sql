-- =============================================================================
-- DM2·S2.8 — tier reclassification (lead-approved: option 1 + the
-- duplicate-retirement amendment, ADR 0118 §10 PROMOTED to a decision) + the
-- canDelete affordance door (lead route on the underLegalHold finding).
--
-- Reclassification = copy → verify → commit-as-NEW-VERSION → retire-source
-- (D10; never a pointer update). The commit is APPEND-ONLY: a new
-- document_version + its own source binding — no edit of the immutable
-- binding, no constraint change (UNIQUE(version, rendition) untouched).
--
-- The retention-exemption class (ADR 0118 §10): reason 'duplicate' is honored
-- ONLY on evidence — a live, servable, same-sha256 file bound to the SAME
-- document. Invariant preserved: A SERVABLE COPY ALWAYS SURVIVES (the last
-- copy has no sibling and meets the retention gate). Guardrails: the
-- last-copy differential pair (329 R6/R7) and the vacuity pin (R8 — a
-- non-duplicated file cannot claim the lane). Kept GENERAL (evidence-gated),
-- not path-narrowed: the guardrail is the EVIDENCE, not caller provenance —
-- a provenance marker would be a claim, strictly weaker than the sha
-- verification; and the only practical creator of the one-file-pending state
-- is the reclassify completion door, which always retires the OLD copy.
-- =============================================================================

-- ── 1 · reclassify_document (begin): authority, hold, mints the successor ────
create or replace function public.reclassify_document(
  p_document_id uuid,
  p_target_tier text
) returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_res public.securable_resources;
  v_old_file public.file_objects;
  v_cur_version public.document_versions;
  v_version_no int;
  v_new_version uuid := gen_random_uuid();
  v_new_file uuid := gen_random_uuid();
  v_bucket text;
begin
  perform app.assert_documents_enabled();
  if not app.can_write_document(p_document_id, v_uid) then
    -- carries the case-arm exclusion deny (229 heritage) inside the canonical door
    raise exception 'apenas a coordenação pode reclassificar este documento'
      using errcode = '42501';
  end if;
  if p_target_tier is null or p_target_tier not in ('standard', 'phi') then
    raise exception 'nível de sensibilidade inválido' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.document_legal_holds h
              where h.document_id = p_document_id and h.released_at is null) then
    raise exception 'documento sob retenção legal — reclassificação bloqueada'
      using errcode = 'HC0D3';
  end if;

  select s.* into v_res
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = p_document_id and d.status = 'active'
   for update of d;
  if v_res.id is null then
    raise exception 'documento indisponível' using errcode = 'HC0D8';
  end if;

  select dv.* into v_cur_version
    from public.document_versions dv
   where dv.document_id = p_document_id
   order by dv.version_number desc limit 1;
  select f.* into v_old_file
    from public.document_version_files vf
    join public.file_objects f on f.id = vf.file_object_id
   where vf.document_version_id = v_cur_version.id and vf.rendition_kind = 'source';
  if v_old_file.id is null
     or v_old_file.disposal_state <> 'none'
     or v_old_file.upload_state not in ('clean', 'unscanned_accepted') then
    raise exception 'arquivo indisponível para reclassificação' using errcode = 'HC0D8';
  end if;
  if v_old_file.sensitivity_tier = p_target_tier then
    raise exception 'o documento já está neste nível de sensibilidade'
      using errcode = 'check_violation';
  end if;

  v_version_no := v_cur_version.version_number + 1;
  v_bucket := case p_target_tier when 'phi' then 'documents-phi' else 'documents-standard' end;

  insert into public.document_versions (id, document_id, version_number, created_by)
  values (v_new_version, p_document_id, v_version_no, v_uid);
  insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
  values (v_new_file, v_bucket,
          v_res.organization_id::text || '/' || v_new_file::text || '/' || gen_random_uuid()::text,
          p_target_tier, v_uid);

  perform app.audit_write(
    'document.reclassify_started', 'document', p_document_id, v_res.commission_id,
    'Reclassificação de sensibilidade iniciada',
    jsonb_build_object('from_tier', v_old_file.sensitivity_tier, 'to_tier', p_target_tier,
                       'version_number', v_version_no));

  return jsonb_build_object(
    'document_id', p_document_id,
    'new_document_version_id', v_new_version,
    'new_file_object_id', v_new_file,
    'old_file_object_id', v_old_file.id,
    'target_tier', p_target_tier);
end;
$$;

-- ── 2 · complete_document_reclassification (SERVICE-ROLE ONLY) ───────────────
-- Copy INTEGRITY is the gate: the service verifier's sha256 of the COPIED
-- bytes must equal the source file's recorded sha256. The new file inherits
-- the source's servable state; the old file enters the disposal machine with
-- the SYSTEM-set 'duplicate' reason (the evidence-gated retirement lane).
create or replace function public.complete_document_reclassification(
  p_document_version_id uuid,
  p_new_file_object_id uuid,
  p_old_file_object_id uuid,
  p_sha256 text
) returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_ver public.document_versions;
  v_new public.file_objects;
  v_old public.file_objects;
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  select * into v_ver from public.document_versions where id = p_document_version_id;
  select * into v_new from public.file_objects where id = p_new_file_object_id for update;
  select * into v_old from public.file_objects where id = p_old_file_object_id for update;
  if v_ver.id is null or v_new.id is null or v_old.id is null then
    raise exception 'reclassificação inconsistente (ids)' using errcode = 'HC0D9';
  end if;
  if v_new.upload_state <> 'reserved'
     or exists (select 1 from public.document_version_files vf
                 where vf.document_version_id = v_ver.id) then
    raise exception 'reclassificação já concluída ou inválida' using errcode = 'HC0D9';
  end if;
  if not exists (
       select 1 from public.document_version_files vf
       join public.document_versions dv on dv.id = vf.document_version_id
      where vf.file_object_id = v_old.id and dv.document_id = v_ver.document_id) then
    raise exception 'o arquivo de origem não pertence a este documento' using errcode = 'HC0D9';
  end if;
  if p_sha256 is null or v_old.sha256 is null or p_sha256 <> v_old.sha256 then
    raise exception 'falha de integridade na cópia (sha divergente)' using errcode = 'HC0D9';
  end if;
  if not exists (select 1 from storage.objects o
                  where o.bucket_id = v_new.storage_bucket and o.name = v_new.storage_path) then
    raise exception 'objeto copiado não encontrado no armazenamento' using errcode = 'HC0D9';
  end if;

  update public.file_objects set upload_state = 'uploaded', uploaded_at = now()
   where id = v_new.id;
  update public.file_objects
     set upload_state = 'verifying', size_bytes = v_old.size_bytes, mime_type = v_old.mime_type
   where id = v_new.id;
  update public.file_objects
     set upload_state = 'scan_pending', sha256 = p_sha256, verified_at = now()
   where id = v_new.id;
  update public.file_objects set upload_state = v_old.upload_state
   where id = v_new.id;

  insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
  values (v_ver.id, v_new.id, 'source');

  -- retire-source: SYSTEM-set duplicate lane (evidence verified at disposal).
  update public.file_objects
     set disposal_state = 'disposal_pending', disposal_reason_category = 'duplicate'
   where id = v_old.id;

  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = v_ver.document_id;
  perform app.audit_write(
    'document.reclassified', 'document', v_ver.document_id, v_commission,
    'Documento reclassificado (nova versão; cópia original em descarte)',
    jsonb_build_object('from_tier', v_old.sensitivity_tier, 'to_tier', v_new.sensitivity_tier,
                       'old_file_object_id', v_old.id, 'new_file_object_id', v_new.id,
                       'version_number', v_ver.version_number));

  return jsonb_build_object('document_id', v_ver.document_id,
                            'document_version_id', v_ver.id,
                            'upload_state', v_new.upload_state);
end;
$$;

-- ── 3 · the evidence-gated duplicate-retirement lane (ADR 0118 §10) ──────────
-- Full re-emit of complete_document_disposal (body minted this slice) with
-- the exemption block added; drift asserts guard the surgery.
do $do$
declare v_src text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_document_disposal';
  if v_src is null or v_src !~ 'HC0DR' then
    raise exception 'S2.8: complete_document_disposal drifted (no retention gate) — re-derive';
  end if;
  if v_src ~ 'is not distinct from' then
    raise exception 'S2.8: the duplicate-evidence gate already present — re-derive';
  end if;
end $do$;

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
  v_exempt boolean := false;
  v_lane text;
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

  -- Exemption lanes through a provisional retention policy (ADR 0118 §10).
  if v_f.disposal_reason_category = 'subject_request' then
    v_exempt := true; v_lane := 'subject_request';
  elsif v_f.disposal_reason_category = 'duplicate' and v_f.sha256 is not null then
    -- EVIDENCE, never a claim: a live, servable, same-sha sibling bound to
    -- the SAME document proves the record survives (last-copy invariant —
    -- the final copy has no sibling and stays behind the gate).
    select exists (
      select 1
        from public.document_version_files vf2
        join public.document_versions dv2 on dv2.id = vf2.document_version_id
        join public.file_objects f2 on f2.id = vf2.file_object_id
       where dv2.document_id = v_doc
         and f2.id <> v_f.id
         and f2.disposal_state = 'none'
         and f2.upload_state in ('clean', 'unscanned_accepted')
         and f2.sha256 is not distinct from v_f.sha256
    ) into v_exempt;
    v_lane := 'duplicate_evidence';
  end if;

  if v_bound and v_provisional and not v_exempt then
    raise exception 'política de retenção provisória — descarte bloqueado até ratificação'
      using errcode = 'HC0DR';
  end if;
  if v_bound and v_provisional and v_exempt then
    perform app.audit_write(
      'document.retention_override', 'document', coalesce(v_doc, v_f.id), v_commission,
      'Descarte prosseguiu sob política de retenção provisória',
      jsonb_build_object('file_object_id', v_f.id, 'lane', v_lane));
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

do $do$
begin
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'complete_document_disposal' and p.prosecdef)
     !~ 'is not distinct from' then
    raise exception 'S2.8 postcondition: the evidence gate did not land (or DEFINER lost)';
  end if;
end $do$;

-- ── 4 · the canDelete affordance door (lead route, underLegalHold finding) ───
-- Batched, one call per list — the same server-computed-affordance principle
-- as canOpen. Accounts for holds WITHOUT disclosing their existence to
-- non-entitled writers (can_read_document_hold's audience ≠
-- can_write_document's — the mismatch that made a type change insufficient).
-- Returns SETOF (non-boolean) → outside the census/ARM-1 domains by
-- definition; behavioral coverage in 329 (findings-file note updated).
create or replace function public.document_delete_affordances(p_document_ids uuid[])
returns table (document_id uuid, can_delete boolean)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select d.id,
         app.can_write_document(d.id, auth.uid())
         and not exists (select 1 from public.document_legal_holds h
                          where h.document_id = d.id and h.released_at is null)
    from public.documents d
   where d.id = any (p_document_ids);
$$;

-- ── 5 · ACLs ─────────────────────────────────────────────────────────────────
revoke all on function public.reclassify_document(uuid, text) from public, anon;
grant execute on function public.reclassify_document(uuid, text) to authenticated, service_role;
revoke all on function public.complete_document_reclassification(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.complete_document_reclassification(uuid, uuid, uuid, text) to service_role;
revoke all on function public.document_delete_affordances(uuid[]) from public, anon;
grant execute on function public.document_delete_affordances(uuid[]) to authenticated, service_role;
