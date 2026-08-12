-- =============================================================================
-- FUP-PDF-3 (QA P1 MINOR-2, ADR 0104): narrow the mint/revoke doors' RETURN
-- shape to the granted column list.
--
-- Both doors returned `printed_documents` (the full row type), so a DIRECT
-- PostgREST caller received the four columns deliberately excluded from the
-- authenticated column-list SELECT GRANT on the table:
--   - verification_token  — THE REAL WIDENING: the public-verification
--     credential, which the caller must never learn from the registry
--     (it is minted server-side and lives inside the PDF's QR only);
--   - storage_path        — derivable from granted columns anyway
--     (defense-in-depth, recorded as Note C);
--   - revoked_by / revoked_reason — the other two ungranted columns.
--
-- DECISION (return-shape): a NAMED COMPOSITE, `public.printed_document_public`,
-- whose fields are EXACTLY the columns the authenticated column-list SELECT
-- GRANT exposes. Why this shape:
--   - the GRANT is the single authority on what a direct caller may see; making
--     the doors return the same surface means the two can never diverge in the
--     caller's favor — a future column joins the composite only when it also
--     receives its own GRANT (the case_referral/profiles column-grant rule);
--   - `RETURNS TABLE` would make the doors set-returning (an ARRAY over
--     PostgREST), breaking the single-object contract the server action reads;
--   - the doors project through jsonb_populate_record BY NAME, so field order
--     can never silently mis-map a column.
--
-- ⚠ A return type cannot change under CREATE OR REPLACE — this is a DROP +
-- CREATE, the exact shape that silently loses properties ("guards that read
-- right but fail open"). The ACL (postgres/service_role/authenticated EXECUTE,
-- nothing for PUBLIC), SECURITY DEFINER, and the pinned search_path are
-- re-stated explicitly below and pinned by pgTAP 323 t10–t13; the before/after
-- property diff is part of the change record.
--
-- Product impact: none. `src/lib/pdf-mint/actions.ts` mints the credentials
-- itself and reads back only summary columns; the revoke caller ignores the
-- returned row entirely. Bodies below are transcribed from the LIVE catalog
-- (pg_get_functiondef, 2026-08-12), not from prior migration text.
-- =============================================================================

create type public.printed_document_public as (
  id uuid,
  source_kind text,
  source_id uuid,
  commission_id uuid,
  template_key text,
  template_version integer,
  content_hash text,
  contains_phi boolean,
  status text,
  verification_short_code text,
  minted_by uuid,
  minted_at timestamptz,
  superseded_at timestamptz,
  revoked_reason_class text,
  revoked_at timestamptz
);

comment on type public.printed_document_public is
  'The printed_documents surface a direct authenticated caller may see — '
  'mirrors the authenticated column-list SELECT GRANT exactly (FUP-PDF-3). '
  'A new printed_documents column joins this type ONLY together with its own '
  'column GRANT; verification_token / storage_path / revoked_by / '
  'revoked_reason stay out by design.';

-- ─────────────────────────────────────────────────────────────────────────────
-- mint_printed_document — body unchanged except RETURNS + the final projection.
-- ─────────────────────────────────────────────────────────────────────────────

drop function public.mint_printed_document(uuid, text, uuid, text, integer, text, text, text, boolean);

create function public.mint_printed_document(
  p_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_template_key text,
  p_template_version integer,
  p_content_hash text,
  p_verification_token text,
  p_verification_short_code text,
  p_contains_phi boolean default false
) returns public.printed_document_public
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
  v_storage_path text;
  v_row public.printed_documents;
begin
  perform app.assert_document_printing_enabled();

  -- AUTHORITY FIRST (M1·4 order): mint right ≡ source visibility (D11 + A7).
  -- A null uid falls out here too (the dispatch fails closed on null).
  if not app.can_view_printed_document(p_source_kind, p_source_id, v_uid) then
    raise exception 'sem autorização para emitir um documento deste registro'
      using errcode = '42501';
  end if;

  -- PHI capability, per kind (A8) — ⚠ the REGISTRATION-MIRROR TRIO, site 3 of
  -- exactly 3 (template coherence · commission resolution · PHI capability;
  -- supersedes the P2 "exactly 2" marker). A FOURTH kind-conditional site in
  -- this door is the abstraction-leak signal — stop and re-plan, never extend.
  --   form_response: PHI-free by classification — contains_phi=true refused.
  --   meeting: ACCEPTS contains_phi (A8 conservative labeling, PRESENCE-derived
  --     by the server action — NOT the D9 per-mint patient-identifier choice,
  --     which remains absent for meetings pending its own domain ADR).
  --   case | interview: refused until their phases register the D9 delegation.
  if coalesce(p_contains_phi, false) and p_source_kind <> 'meeting' then
    raise exception 'este tipo de documento não permite emissão com dados de paciente'
      using errcode = 'HC0D2';
  end if;

  -- Template coherence: the registered template set per kind.
  -- ⚠ Registration-mirror trio, site 1 of exactly 3 (A8).
  if p_source_kind = 'form_response' and p_template_key <> 'form_response' then
    raise exception 'modelo de documento inválido para este tipo de registro'
      using errcode = 'HC0D1';
  end if;
  if p_source_kind = 'meeting' and p_template_key <> 'meeting' then
    raise exception 'modelo de documento inválido para este tipo de registro'
      using errcode = 'HC0D1';
  end if;

  -- Amendment A: credential FORMAT is door-enforced; generation is the
  -- action's (the token must be inside the canonical bytes' QR).
  -- Token: URL-safe base64 alphabet, >= 32 chars (>= 192 bits).
  if p_verification_token is null
     or p_verification_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'token de verificação em formato inválido'
      using errcode = 'HC0D1';
  end if;
  -- Short code: exactly 10 chars of the unambiguous alphabet (no I/O/0/1).
  if p_verification_short_code is null
     or p_verification_short_code !~ '^[A-HJ-NP-Z2-9]{10}$' then
    raise exception 'código de verificação em formato inválido'
      using errcode = 'HC0D1';
  end if;

  -- Owning commission, per kind (only reachable for kinds whose visibility
  -- arm exists — everything else already failed the authority check above).
  -- ⚠ Registration-mirror trio, site 2 of exactly 3 (A8).
  if p_source_kind = 'form_response' then
    select commission_id into v_commission
    from public.responses where id = p_source_id;
  elsif p_source_kind = 'meeting' then
    v_commission := app.commission_of_meeting(p_source_id);
  end if;
  if v_commission is null then
    raise exception 'registro de origem não encontrado'
      using errcode = 'HC0D1';
  end if;

  v_storage_path :=
    (case when p_contains_phi then 'phi/' else 'std/' end) || p_id::text || '.pdf';

  -- AMENDMENT B: the object must already exist at the derived path — a
  -- registry row never points at a missing object (upload-before-mint, D5).
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'printed-documents' and name = v_storage_path
  ) then
    raise exception 'objeto de armazenamento ausente para esta emissão'
      using errcode = 'HC0D3';
  end if;

  -- Supersession (D6) + insert, atomically in this transaction.
  -- SUPERSEDE_ACTIVE: the registry always knows the current print.
  update public.printed_documents
     set status = 'superseded', superseded_at = now()
   where source_kind = p_source_kind
     and source_id = p_source_id
     and template_key = p_template_key
     and status = 'active';

  begin
    insert into public.printed_documents (
      id, source_kind, source_id, commission_id, template_key, template_version,
      content_hash, storage_path, contains_phi, status,
      verification_token, verification_short_code, minted_by
    ) values (
      p_id, p_source_kind, p_source_id, v_commission, p_template_key,
      p_template_version, p_content_hash, v_storage_path,
      coalesce(p_contains_phi, false), 'active',
      p_verification_token, p_verification_short_code, v_uid
    )
    returning * into v_row;
  exception
    when unique_violation then
      -- Amendment A: distinct code — the action re-mints with fresh
      -- credentials (full re-render; the short code is in the bytes).
      raise exception 'colisão de identificador de verificação — repita a emissão'
        using errcode = 'HC0D4';
  end;

  perform app.audit_write(
    'document.minted', 'printed_document', p_id, v_commission,
    'Documento PDF emitido',
    jsonb_build_object(
      'source_kind', p_source_kind,
      'source_id', p_source_id,
      'template_key', p_template_key,
      'template_version', p_template_version,
      'contains_phi', coalesce(p_contains_phi, false),
      'content_hash', p_content_hash));

  -- FUP-PDF-3: project BY NAME onto the granted-column composite — the
  -- withheld columns (verification_token, storage_path, revoked_by,
  -- revoked_reason) never leave the door.
  return jsonb_populate_record(null::public.printed_document_public, to_jsonb(v_row));
end;
$$;

-- The rebuild loses the ACL — re-state it exactly (was: postgres=X,
-- service_role=X, authenticated=X; nothing for PUBLIC).
revoke all on function public.mint_printed_document(uuid, text, uuid, text, integer, text, text, text, boolean) from public;
grant execute on function public.mint_printed_document(uuid, text, uuid, text, integer, text, text, text, boolean) to service_role;
grant execute on function public.mint_printed_document(uuid, text, uuid, text, integer, text, text, text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- revoke_printed_document — body unchanged except RETURNS + the final
-- projection. (The product caller ignores the returned row entirely; the
-- narrowed shape is kept symmetric with the mint door.)
-- ─────────────────────────────────────────────────────────────────────────────

drop function public.revoke_printed_document(uuid, text, text);

create function public.revoke_printed_document(
  p_id uuid,
  p_reason_class text,
  p_reason text
) returns public.printed_document_public
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.printed_documents;
begin
  perform app.assert_document_printing_enabled();

  select * into v_row from public.printed_documents where id = p_id;

  -- REVOKE_AUTHORITY first (M1·4 order; QA MINOR-4): not-found and
  -- not-authorized are ONE indistinguishable denial — no existence oracle.
  if v_row.id is null
     or not (app.is_staff_admin_of_for(v_row.commission_id, auth.uid())
             or app.is_tenancy_admin_of_for(v_row.commission_id, auth.uid())) then
    raise exception 'apenas a coordenação da comissão ou um administrador da organização pode anular um documento emitido'
      using errcode = '42501';
  end if;

  if p_reason_class is null
     or p_reason_class not in ('wrong_data', 'minted_in_error', 'other') then
    raise exception 'classe de motivo de anulação inválida'
      using errcode = 'HC0D1';
  end if;
  -- Mandatory free-text reason (D6). PHI-FREE by instruction in the revoke
  -- dialog — governance text about the record, never source content.
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'o motivo da anulação é obrigatório'
      using errcode = 'HC0D1';
  end if;
  if v_row.status = 'revoked' then
    raise exception 'este documento já foi anulado'
      using errcode = 'HC0D5';
  end if;

  update public.printed_documents
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = auth.uid(),
         revoked_reason_class = p_reason_class,
         revoked_reason = p_reason
   where id = p_id
   returning * into v_row;

  -- D12 records reason class + free text (the ADR's explicit spec for this
  -- event; the reason is PHI-free governance text about the record).
  perform app.audit_write(
    'document.revoked', 'printed_document', p_id, v_row.commission_id,
    'Documento PDF anulado',
    jsonb_build_object('reason_class', p_reason_class, 'reason', p_reason));

  -- FUP-PDF-3: project BY NAME onto the granted-column composite.
  return jsonb_populate_record(null::public.printed_document_public, to_jsonb(v_row));
end;
$$;

revoke all on function public.revoke_printed_document(uuid, text, text) from public;
grant execute on function public.revoke_printed_document(uuid, text, text) to service_role;
grant execute on function public.revoke_printed_document(uuid, text, text) to authenticated;
