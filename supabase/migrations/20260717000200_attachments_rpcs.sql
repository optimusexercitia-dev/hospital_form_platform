-- =============================================================================
-- F2 (ADR 0063 / phase-14e §D5–D7) — Centralized Attachments, migration 3 of 6
-- [🔴 SECURITY-CRITICAL]: the attachment write/open/reclassify/soft-delete/dispose
-- RPCs. All SECURITY DEFINER + t19 (REVOKE ALL FROM PUBLIC before GRANT; NO anon
-- EXECUTE). The DEFINER functions are owned by postgres and so bypass RLS on
-- public.attachments (writes reach the table with no authenticated write grant).
--
--   • create_attachment       — assert flag → can_write_attachment → validate kind per
--                                owner_type → resolve tier/label (label→tier escalation,
--                                defence-in-depth) → verify object in the tier bucket →
--                                insert.
--   • open_attachment         — the AUDITED PHI-READ DOOR (§C.2). NULL-out-of-scope:
--                                a foreigner gets NO row, NO signed URL, NO audit. A phi
--                                open writes EXACTLY ONE attachment.read; a standard open
--                                (or a denied attempt) writes none.
--   • reclassify_attachment   — DIRECTIONAL: escalate = any writer; DECLASSIFY
--                                (phi→standard) = staff_admin/org-admin only. Audited as
--                                attachment.reclassified (via the trigger's tier/bucket
--                                change detection). Brackets the immutability guard.
--   • soft_delete_attachment  — set deleted_at/deleted_by; object retained (Rule 6).
--   • dispose_attachment_phi  — clone of dispose_event_phi: reject legal_hold (HC098) +
--                                double-dispose (HC097); null title/description; stamp
--                                phi_disposed_*; audit attachment.phi_disposed. Object kept.
--
-- kind-invalid and all flag/authz/tier CHECK violations reuse check_violation / 42501
-- (contract §H, Q8 — HC099 dropped).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_attachment — the single write door for a new attachment row.
-- -----------------------------------------------------------------------------
create or replace function public.create_attachment(
  p_owner_type text,
  p_owner_id uuid,
  p_storage_path text,
  p_title text,
  p_kind text default null,
  p_description text default null,
  p_occurred_on date default null,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_sha256 text default null,
  p_sensitivity_tier text default null,
  p_confidentiality_label text default null
) returns public.attachments
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_kind text;
  v_tier text;
  v_label text;
  v_bucket text;
  v_row public.attachments;
begin
  perform app.assert_attachments_enabled();

  if not app.can_write_attachment(p_owner_type, p_owner_id, auth.uid()) then
    raise exception 'sem permissão para anexar a este recurso' using errcode = '42501';
  end if;

  -- kind: default per owner_type, then validate against the per-owner_type set.
  v_kind := coalesce(p_kind, case when p_owner_type = 'case' then 'other' else 'outro' end);
  if (p_owner_type = 'case'        and v_kind not in ('ata', 'digitalizacao', 'registro', 'other'))
     or (p_owner_type = 'meeting'     and v_kind not in ('pauta', 'apresentacao', 'literatura', 'lista_presenca', 'ata_assinada', 'outro'))
     or (p_owner_type = 'interview'   and v_kind not in ('gravacao_audio', 'transcricao_assinada', 'evidencia', 'outro'))
     or (p_owner_type = 'action_item' and v_kind not in ('evidencia', 'outro'))
     or (p_owner_type = 'form_upload') then
    raise exception 'tipo de documento inválido para este anexo' using errcode = 'check_violation';
  end if;

  -- tier / label defaults per owner_type (§F): case/interview ⇒ phi/phi_standard;
  -- meeting/action_item ⇒ standard/non_phi_internal.
  v_tier := coalesce(p_sensitivity_tier,
    case when p_owner_type in ('case', 'interview') then 'phi' else 'standard' end);
  v_label := coalesce(p_confidentiality_label,
    case when p_owner_type in ('case', 'interview') then 'phi_standard' else 'non_phi_internal' end);

  -- label → tier escalation (defence in depth; the CHECK also enforces this).
  if v_label in ('phi_standard', 'phi_restricted') then
    v_tier := 'phi';
  end if;
  if v_tier not in ('phi', 'standard') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  v_bucket := case when v_tier = 'phi' then 'attachments-phi' else 'attachments' end;

  -- Verify the object was already uploaded to the correct tier bucket (14e).
  if not exists (
    select 1 from storage.objects
    where bucket_id = v_bucket and name = p_storage_path
  ) then
    raise exception 'objeto não encontrado no bucket de destino' using errcode = 'check_violation';
  end if;

  insert into public.attachments (
    owner_type, owner_id, kind, title, description, occurred_on,
    storage_bucket, storage_path, mime_type, size_bytes, sha256,
    sensitivity_tier, confidentiality_label, uploaded_by
  ) values (
    p_owner_type, p_owner_id, v_kind, p_title, p_description, p_occurred_on,
    v_bucket, p_storage_path, p_mime_type, p_size_bytes, p_sha256,
    v_tier, v_label, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.create_attachment(text, uuid, text, text, text, text, date, text, bigint, text, text, text) owner to postgres;
revoke all on function public.create_attachment(text, uuid, text, text, text, text, date, text, bigint, text, text, text) from public;
grant execute on function public.create_attachment(text, uuid, text, text, text, text, date, text, bigint, text, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- open_attachment — the audited PHI-read door (§C.2). Returns 0 rows (NULL-out-of-
-- scope) when not found / infected / soft-deleted / not readable; exactly the
-- (bucket, path) otherwise. A phi open writes EXACTLY ONE attachment.read; a standard
-- open and every denied attempt write NONE.
-- -----------------------------------------------------------------------------
create or replace function public.open_attachment(p_id uuid)
  returns table(bucket text, path text)
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.attachments;
begin
  perform app.assert_attachments_enabled();

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    return;                                          -- not found
  end if;
  if v_row.deleted_at is not null then
    return;                                          -- soft-deleted: gone
  end if;
  if v_row.scan_status = 'infected' then
    return;                                          -- never serve an infected object
  end if;
  if not app.can_read_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
    return;                                          -- NULL-out-of-scope: no row, no audit
  end if;

  if v_row.sensitivity_tier = 'phi' then
    -- the single audited PHI open (Rule 11/12) — records THAT + WHO, never the blob.
    perform public.log_audit_access(
      'attachment.read', 'attachment', p_id,
      app.commission_of_attachment(v_row.owner_type, v_row.owner_id),
      'Anexo (PHI) aberto', '{}'::jsonb);
  end if;

  return query select v_row.storage_bucket, v_row.storage_path;
end;
$$;
alter function public.open_attachment(uuid) owner to postgres;
revoke all on function public.open_attachment(uuid) from public;
grant execute on function public.open_attachment(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- reclassify_attachment — directional tier change (§F). Escalate = any writer;
-- declassify (phi→standard) = staff_admin/org-admin only. Brackets the immutability
-- guard so it may flip bucket+tier. The trigger emits attachment.reclassified.
-- (Next orchestrates the physical re-home: copy object → this RPC → remove source.)
-- -----------------------------------------------------------------------------
create or replace function public.reclassify_attachment(
  p_id uuid, p_new_tier text, p_new_label text default null
) returns public.attachments
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.attachments;
  v_commission uuid;
  v_new_bucket text;
  v_new_label text;
begin
  perform app.assert_attachments_enabled();

  if p_new_tier not in ('phi', 'standard') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    raise exception 'anexo não encontrado' using errcode = 'P0002';
  end if;
  v_commission := app.commission_of_attachment(v_row.owner_type, v_row.owner_id);

  -- Directional authz: declassify (phi→standard) is staff_admin/org-admin only.
  if p_new_tier = 'standard' and v_row.sensitivity_tier = 'phi' then
    if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
      raise exception 'apenas a coordenação pode reduzir a classificação de um anexo'
        using errcode = '42501';
    end if;
  else
    if not app.can_write_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
      raise exception 'sem permissão para reclassificar este anexo' using errcode = '42501';
    end if;
  end if;

  v_new_bucket := case when p_new_tier = 'phi' then 'attachments-phi' else 'attachments' end;

  -- Resolve a label consistent with the new tier (defence in depth). A patient-PHI
  -- label cannot survive a declassify.
  v_new_label := coalesce(p_new_label, v_row.confidentiality_label);
  if p_new_tier = 'standard' and v_new_label in ('phi_standard', 'phi_restricted') then
    v_new_label := 'non_phi_internal';
  end if;
  if v_new_label in ('phi_standard', 'phi_restricted') and p_new_tier <> 'phi' then
    raise exception 'rótulo incompatível com a classificação' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_attachments_rpc', 'on', true);
  update public.attachments
     set sensitivity_tier = p_new_tier,
         storage_bucket = v_new_bucket,
         confidentiality_label = v_new_label,
         updated_at = now()
   where id = p_id
  returning * into v_row;
  perform set_config('app.in_attachments_rpc', 'off', true);

  return v_row;
end;
$$;
alter function public.reclassify_attachment(uuid, text, text) owner to postgres;
revoke all on function public.reclassify_attachment(uuid, text, text) from public;
grant execute on function public.reclassify_attachment(uuid, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- soft_delete_attachment — logical delete; the storage object is retained (Rule 6).
-- deleted_at is not in the frozen set, so no bracket is needed. Trigger emits
-- attachment.deleted.
-- -----------------------------------------------------------------------------
create or replace function public.soft_delete_attachment(p_id uuid)
  returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.attachments;
begin
  perform app.assert_attachments_enabled();

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    raise exception 'anexo não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_write_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
    raise exception 'sem permissão para remover este anexo' using errcode = '42501';
  end if;

  update public.attachments
     set deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
   where id = p_id and deleted_at is null;
end;
$$;
alter function public.soft_delete_attachment(uuid) owner to postgres;
revoke all on function public.soft_delete_attachment(uuid) from public;
grant execute on function public.soft_delete_attachment(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- dispose_attachment_phi — single-attachment PHI disposal (clone of dispose_event_phi).
-- Hard-rejects a legal-hold row (HC098) and a double-dispose (HC097). Redacts the
-- PHI-bearing metadata (title/description); the storage object is RETAINED (Rule 6;
-- ADR 0056 narrowed-erasure footnote).
-- -----------------------------------------------------------------------------
create or replace function public.dispose_attachment_phi(p_id uuid, p_reason text)
  returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.attachments;
  v_commission uuid;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_attachments_enabled();

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    raise exception 'anexo não encontrado' using errcode = 'P0002';
  end if;
  v_commission := app.commission_of_attachment(v_row.owner_type, v_row.owner_id);

  if not app.can_write_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
    raise exception 'sem permissão para descartar os dados deste anexo' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if v_row.legal_hold then
    raise exception 'anexo sob retenção legal não pode ser descartado' using errcode = 'HC098';
  end if;
  if v_row.phi_disposed_at is not null then
    raise exception 'os dados deste anexo já foram descartados' using errcode = 'HC097';
  end if;

  perform set_config('app.in_attachments_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  update public.attachments
     set title = v_redacted, description = null,
         phi_disposed_at = now(), phi_disposed_by = auth.uid(), phi_disposed_reason = p_reason,
         updated_at = now()
   where id = p_id;

  -- QA phase-F2-review INFO-1: the UPDATE above ALSO fires the AFTER-UPDATE audit
  -- trigger (attachment.updated — it changes neither tier/bucket/label/deleted_at,
  -- so it falls through to the default action), giving this call two audit rows.
  -- Intentional / accepted: MORE audit coverage, not less, and the allow-list
  -- excludes title/description so no PHI reaches either row. Left unchanged.
  perform app.audit_write('attachment.phi_disposed', 'attachment', p_id, v_commission,
    'Dados do anexo descartados', jsonb_build_object('reason', p_reason));

  perform set_config('app.in_attachments_rpc', 'off', true);
end;
$$;
alter function public.dispose_attachment_phi(uuid, text) owner to postgres;
revoke all on function public.dispose_attachment_phi(uuid, text) from public;
grant execute on function public.dispose_attachment_phi(uuid, text) to authenticated, service_role;
