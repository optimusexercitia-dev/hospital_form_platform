-- =============================================================================
-- PDF·P2 M-B3 — the `meeting` arm (ADR 0104 D15 rollout step 2; plan §3;
-- lead-acked plan 2026-08-08).
--
-- Two CREATE OR REPLACE re-emits (never DROP — a rebuild silently loses
-- properties; ACL/prosecdef/proconfig are property-diffed old-vs-new from the
-- catalog after apply):
--
-- 1. app.can_view_printed_document gains the meeting arm — PURE DELEGATION to
--    `app.can_reach_meeting(id, uid)`, the exact explicit-uid predicate every
--    meeting child SELECT policy already routes (meeting_attendees /
--    meeting_agenda_items / meeting_signatures — catalog-verified 2026-08-08).
--    Deliberately NO admin arm: the meetings domain admits members (+ the
--    attendee gate under `participants_only`) and NOTHING else since the C7
--    org-surface cut — the module never grants sight the domain doesn't (D11).
--    313 pins that delta with org_admin AND hospital_admin DENY probes.
--
-- 2. public.mint_printed_document gains the meeting rows of its TWO per-kind
--    blocks (template coherence + commission resolution). ⚠ LEAD RULING
--    (2026-08-08, recorded in the P2 lead notes): these two sites are the SQL
--    mirror of provider registration and the ONLY sanctioned per-kind
--    conditionals in this door. If a phase ever needs a THIRD kind-conditional
--    site here, that is the abstraction-leak signal — stop and re-plan, do not
--    extend.
-- =============================================================================

create or replace function app.can_view_printed_document(
  p_source_kind text,
  p_source_id uuid,
  p_uid uuid
) returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_resp public.responses;
begin
  if p_uid is null or p_source_id is null then
    return false;
  end if;

  case p_source_kind
    when 'form_response' then
      select * into v_resp from public.responses where id = p_source_id;
      if v_resp.id is null then
        return false;
      end if;
      -- Mirror of the LIVE responses read policies (parity, not improvement —
      -- over-reach breaks legitimate surface):
      --   responses_select: own row OR commission-admin chain OR
      --     (submitted AND staff_admin) OR correction-corridor
      --   responses_select_targeted: targeted-respondent corridor
      --   responses_admin_all: commission-admin chain (already covered)
      return v_resp.created_by = p_uid
          or app.is_commission_admin_of_for(v_resp.commission_id, p_uid)
          or (v_resp.status = 'submitted'
              and app.is_staff_admin_of_for(v_resp.commission_id, p_uid))
          or app.can_read_correction_response(p_source_id, p_uid)
          or app.can_access_targeted_response(p_source_id, p_uid);
    when 'meeting' then
      -- PDF·P2: pure delegation to THE meeting-visibility predicate (the one
      -- every meeting child policy routes). Member AND (commission_default OR
      -- attendee); nonexistent id resolves a null commission -> false. NO
      -- admin arm, deliberately — the domain has none (C7), and the module
      -- never grants sight the domain doesn't (D11).
      return app.can_reach_meeting(p_source_id, p_uid);
    else
      -- case | interview arms land in P3..P4 (one per phase).
      -- ELSE_FAIL_CLOSED: an unhandled kind is UNREADABLE, not exposed
      -- (ADR 0104 D3) — a new printable kind that forgets its arm fails shut.
      return false;
  end case;
end;
$$;

create or replace function public.mint_printed_document(
  p_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_template_key text,
  p_template_version int,
  p_content_hash text,
  p_verification_token text,
  p_verification_short_code text,
  p_contains_phi boolean default false
) returns public.printed_documents
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

  -- AUTHORITY FIRST (M1·4 order): mint right ≡ source visibility (D11).
  -- A null uid falls out here too (the dispatch fails closed on null).
  if not app.can_view_printed_document(p_source_kind, p_source_id, v_uid) then
    raise exception 'sem autorização para emitir um documento deste registro'
      using errcode = '42501';
  end if;

  -- P1/P2: no PHI-capable kind is registered — a PHI mint FAILS CLOSED (D9).
  -- P3 replaces this with the source domain's own PHI door delegation.
  if coalesce(p_contains_phi, false) then
    raise exception 'este tipo de documento não permite emissão com dados de paciente'
      using errcode = 'HC0D2';
  end if;

  -- Template coherence: the registered template set per kind.
  -- ⚠ Per-kind CASE site 1 of exactly 2 (the lead's smell-marker ruling — a
  -- THIRD kind-conditional site in this door is the abstraction-leak signal).
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
  -- ⚠ Per-kind CASE site 2 of exactly 2 (same smell-marker ruling).
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

  return v_row;
end;
$$;
