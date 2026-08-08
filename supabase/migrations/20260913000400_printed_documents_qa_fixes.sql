-- =============================================================================
-- PDF·P1 QA fix wave — MINOR-4 (phase-PDF-P1-review, lead FIX-3).
--
-- revoke_printed_document checked EXISTENCE (P0002) before AUTHORITY (42501),
-- which is an existence oracle: an unauthorized caller could distinguish "this
-- registry id exists" from "it does not" by the error code. The mint door in
-- the same file gets the order right; this re-emit matches its shape by
-- MERGING not-found into the authority denial — a nonexistent document and an
-- unauthorized one now raise the SAME 42501, indistinguishably. P0002 leaves
-- this module's surface entirely (open_ returns no-row; lookup_ answers
-- matched=false).
--
-- Forward-only discipline: M2 (20260913000100) is applied locally, so the fix
-- is a NEW migration, never an edit to the applied file. CREATE OR REPLACE
-- preserves the existing ACL ({postgres,authenticated,service_role} EXECUTE —
-- re-verified against proacl after apply); header attributes are IDENTICAL to
-- M2's (SECURITY DEFINER, search_path) — only the check order changes.
-- =============================================================================

create or replace function public.revoke_printed_document(
  p_id uuid,
  p_reason_class text,
  p_reason text
) returns public.printed_documents
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
             or app.is_commission_admin_of_for(v_row.commission_id, auth.uid())) then
    raise exception 'apenas a coordenação da comissão pode anular um documento emitido'
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

  return v_row;
end;
$$;
