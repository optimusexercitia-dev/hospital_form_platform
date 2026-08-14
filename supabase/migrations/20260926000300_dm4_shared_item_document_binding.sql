-- =============================================================================
-- DM4 M3 — the frozen-snapshot seam: version binding, the un-parked document
-- arm, the bespoke audited door (ADR 0119 D3/D4/D5/D7).
--
-- Own migration because: the write seam, the read seam and the shape
-- constraint are ONE invariant set (step-0 finding: un-parking the write arm
-- without re-pointing the read arm, or vice versa, mints a write/read
-- mismatch). Keystones: 340 C1–C15.
--
-- A freeze is a BINDING to one immutable document version (append-only rows +
-- Rule-6 immutable bytes make it supersession-immune by construction), plus
-- value-copies of the display metadata. Bytes serve ONLY through
-- open_referral_snapshot_document (PHI-gated, audited exactly once).
-- =============================================================================

-- 1. The binding + tombstone columns. RESTRICT: a version bound by a frozen
--    snapshot cannot be deleted (340 C9). Tombstone = the snapshot survives
--    as a governance record, permanently unservable ('legacy_unreconciled' has
--    NO live writer post-DM4 — it exists for reconciled pre-DM4 rows and the
--    seeded specimen; 'phi_disposed' is written by dispose_referral_phi).
alter table public.referral_shared_item
  add column frozen_document_version_id uuid
    references public.document_versions (id) on delete restrict,
  add column frozen_tombstoned_at timestamptz,
  add column frozen_tombstone_reason text,
  add constraint referral_shared_item_tombstone_pair
    check ((frozen_tombstoned_at is null) = (frozen_tombstone_reason is null)),
  add constraint referral_shared_item_tombstone_reason
    check (frozen_tombstone_reason is null
           or frozen_tombstone_reason in ('legacy_unreconciled', 'phi_disposed'));

-- 2. SELF-PROVING dead-pointer guard (ADR 0119 D7, lead-approved shape:
--    plant → guard → RAISE unless nulled → delete → FK). DM1–DM3 were never
--    pushed, so a data-bearing database still running the pre-DM1 arm may
--    carry source_document_id values pointing at the DROPPED attachments
--    table; the old FK was ON DELETE SET NULL and drop-ordering may have
--    skipped its application. The guard applies it late; the specimen proof
--    runs whenever a referral exists to carry it (on an empty reset database
--    no dead pointer is representable and the unconditional post-condition
--    below still holds).
do $$
declare
  v_specimen uuid;
  v_left int;
begin
  perform set_config('app.in_referral_rpc', 'on', true);
  insert into public.referral_shared_item
    (referral_id, kind, source_document_id, frozen_title, frozen_storage_path, position)
  select r.id, 'document', gen_random_uuid(), 'dm4-dead-pointer-specimen',
         'dm4/specimen/' || gen_random_uuid(), 990
    from public.case_referral r
   limit 1
  returning id into v_specimen;
  if v_specimen is null then
    raise notice 'DM4 M3 guard proof: empty database, no specimen carrier — post-condition still asserted';
  end if;

  -- THE GUARD: null every provenance pointer that does not resolve to
  -- documents(id) — late application of the old FK's ON DELETE SET NULL.
  update public.referral_shared_item s
     set source_document_id = null
   where s.source_document_id is not null
     and not exists (select 1 from public.documents d where d.id = s.source_document_id);

  if v_specimen is not null then
    select count(*) into v_left
      from public.referral_shared_item
     where id = v_specimen and source_document_id is not null;
    if v_left <> 0 then
      raise exception 'DM4 M3 guard proof FAILED: the dead pointer survived';
    end if;
    delete from public.referral_shared_item where id = v_specimen;
  end if;

  -- Unconditional post-condition: the FK below must find nothing to reject.
  if exists (select 1 from public.referral_shared_item s
              where s.source_document_id is not null
                and not exists (select 1 from public.documents d
                                 where d.id = s.source_document_id)) then
    raise exception 'DM4 M3: unresolvable source_document_id rows remain';
  end if;
  perform set_config('app.in_referral_rpc', 'off', true);
end $$;

-- 3. THE FK THAT DID NOT EXIST (ADR 0116 D1 dropped it; DM4 creates it).
--    SET NULL mirrors the narrative sibling: provenance, not custody.
alter table public.referral_shared_item
  add constraint referral_shared_item_source_document_id_fkey
  foreign key (source_document_id) references public.documents (id) on delete set null;

-- 4. Inline legacy reconciliation (the deleted M5's semantics, exactly where
--    they are needed — before the CHECK swap would reject legacy rows on a
--    data-bearing database). 0 rows on every reset; tombstones the pre-DM4
--    dangling shape at a future push. Tombstone nulls the dead path.
update public.referral_shared_item
   set frozen_tombstoned_at = now(),
       frozen_tombstone_reason = 'legacy_unreconciled',
       frozen_storage_path = null
 where kind = 'document'
   and frozen_document_version_id is null
   and frozen_tombstoned_at is null;

-- 5. The shape CHECK, re-stated on the new substrate: a document row is
--    version-bound XOR tombstoned; narratives are value-copies, untouched.
--    frozen_storage_path is deliberately UNREFERENCED (M4 drops the column).
alter table public.referral_shared_item
  drop constraint referral_shared_item_shape;
alter table public.referral_shared_item
  add constraint referral_shared_item_shape
  check (
    (kind = 'narrative' and frozen_body_md is not null
       and frozen_document_version_id is null and frozen_tombstoned_at is null)
    or
    (kind = 'document' and frozen_body_md is null
       and ((frozen_document_version_id is not null and frozen_tombstoned_at is null)
            or (frozen_document_version_id is null and frozen_tombstoned_at is not null)))
  );

-- 6. The document arm, UN-PARKED (replaces the HC0DM park; ADR 0119 D4/D6).
create or replace function public.add_referral_shared_item(
  p_referral_id uuid, p_kind text,
  p_source_narrative_id uuid default null::uuid,
  p_source_document_id uuid default null::uuid)
returns public.referral_shared_item
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_referral public.case_referral;
  v_narrative public.case_narratives;
  v_doc public.documents;
  v_home_type text;
  v_version_id uuid;
  v_mime text;
  v_size bigint;
  v_next_pos integer;
  v_row public.referral_shared_item;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_draft_writable(p_referral_id);

  if p_kind not in ('narrative', 'document') then
    raise exception 'tipo de item inválido' using errcode = 'HC077';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_pos
  from public.referral_shared_item where referral_id = p_referral_id;

  perform set_config('app.in_referral_rpc', 'on', true);

  if p_kind = 'narrative' then
    if p_source_narrative_id is null then
      raise exception 'selecione a narrativa a compartilhar' using errcode = 'HC077';
    end if;
    select * into v_narrative from public.case_narratives
      where id = p_source_narrative_id and case_id = v_referral.source_case_id;
    if v_narrative.id is null then
      raise exception 'narrativa não encontrada neste caso' using errcode = 'HC077';
    end if;
    insert into public.referral_shared_item (
      referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position
    ) values (
      p_referral_id, 'narrative', v_narrative.id,
      coalesce(v_narrative.title, v_narrative.type_label),
      coalesce(v_narrative.body_md, ''), v_next_pos
    )
    returning * into v_row;
  else
    -- DM4 (ADR 0119 D3/D4): the document arm, live on the document model.
    -- Wave-C-gated at ITS first residue-producing step, arm-scoped so the
    -- narrative arm is untouched (340 C7a/C7b).
    perform app.assert_documents_wave_c_enabled();
    if p_source_document_id is null then
      raise exception 'selecione o documento a compartilhar' using errcode = 'HC077';
    end if;
    -- The source must be a CASE document of THIS referral's source case —
    -- absence and cross-case are the same refusal (oracle-kill).
    select d.* into v_doc
      from public.documents d
      join public.securable_resources s on s.id = d.home_resource_id
     where d.id = p_source_document_id
       and s.resource_type = 'case'
       and d.home_resource_id = v_referral.source_case_id
       and d.status = 'active';
    if v_doc.id is null then
      raise exception 'documento não encontrado neste caso' using errcode = 'HC077';
    end if;
    -- ADR 0119 D4 (PO): an ENFORCING label refuses the freeze — the referral
    -- corridor has no clearance plane, so the D15 ceiling must not be
    -- laundered through it. A label applied AFTER a freeze does not retract
    -- it (the freeze-wins corollary); this gate governs future freezes only.
    if v_doc.confidentiality_level in ('legal_privileged', 'credentialing_sensitive') then
      raise exception
        'documentos com confidencialidade restrita não podem ser compartilhados em encaminhamentos'
        using errcode = 'HC0DC';
    end if;
    -- Freeze = bind the LATEST version that carries a servable source file.
    select dv.id, f.mime_type, f.size_bytes
      into v_version_id, v_mime, v_size
      from public.document_versions dv
      join public.document_version_files vf
        on vf.document_version_id = dv.id and vf.rendition_kind = 'source'
      join public.file_objects f on f.id = vf.file_object_id
     where dv.document_id = v_doc.id
       and f.upload_state in ('clean', 'unscanned_accepted')
       and f.disposal_state = 'none'
     order by dv.version_number desc, vf.created_at desc
     limit 1;
    if v_version_id is null then
      raise exception 'arquivo ainda não disponível' using errcode = 'HC0D8';
    end if;
    insert into public.referral_shared_item (
      referral_id, kind, source_document_id, frozen_document_version_id,
      frozen_title, frozen_mime_type, frozen_size_bytes, position
    ) values (
      p_referral_id, 'document', v_doc.id, v_version_id,
      v_doc.title, v_mime, v_size, v_next_pos
    )
    returning * into v_row;
  end if;

  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;

-- 7. THE bespoke audited door (ADR 0119 D3; ADR 0114 D8 topology: the door
--    authorizes + audits and returns IDS ONLY — the TS layer resolves
--    coordinates with the service client and signs short-TTL). Gate is
--    can_read_referral_phi, full stop — referral access never rides the
--    document kernel, and vice versa (340 C11b/C12, the negative twin).
--    D5: soft-delete of the source is deliberately NOT checked (B's
--    disclosure record survives A's retraction); disposal fails closed.
create function public.open_referral_snapshot_document(p_shared_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_item public.referral_shared_item;
  v_referral public.case_referral;
  v_ver public.document_versions;
  v_doc public.documents;
  v_file public.file_objects;
begin
  perform app.assert_referrals_enabled();
  select * into v_item from public.referral_shared_item where id = p_shared_item_id;
  if v_item.id is null or v_item.kind <> 'document' then
    return null;                       -- absence ≡ denial
  end if;
  select * into v_referral from public.case_referral where id = v_item.referral_id;
  if v_referral.id is null then
    return null;
  end if;
  if not app.can_read_referral_phi(v_item.referral_id, auth.uid()) then
    return null;                       -- denial mints NO audit row (D11)
  end if;

  if v_item.frozen_tombstoned_at is not null or v_item.frozen_document_version_id is null then
    raise exception 'o documento deste encaminhamento não está mais disponível'
      using errcode = 'HC0DS';
  end if;

  select * into v_ver from public.document_versions
   where id = v_item.frozen_document_version_id;
  select * into v_doc from public.documents where id = v_ver.document_id;
  -- ADR 0119 D5: disposal-track fails closed; 'soft_deleted' deliberately
  -- SERVES (the frozen disclosure record outlives the source's retraction).
  if v_doc.status in ('disposal_pending', 'disposed') then
    raise exception 'documento descartado' using errcode = 'HC0DD';
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

  -- EXACTLY ONE audit row per served open (exit criterion 2). The event stays
  -- referral.viewed — this corridor is referral access, not document access.
  perform public.log_audit_access(
    'referral.viewed', 'referral', v_item.referral_id, v_referral.source_commission_id,
    'Documento do encaminhamento ' || coalesce(v_referral.code, '') || ' acessado', '{}'::jsonb);

  return jsonb_build_object(
    'document_id', v_doc.id,
    'document_version_id', v_ver.id,
    'file_object_id', v_file.id,
    'title', v_doc.title,
    'mime_type', v_file.mime_type,
    'size_bytes', v_file.size_bytes,
    'sensitivity_tier', v_file.sensitivity_tier);
end;
$$;
revoke all on function public.open_referral_snapshot_document(uuid) from public, anon;
grant execute on function public.open_referral_snapshot_document(uuid) to authenticated, service_role;
