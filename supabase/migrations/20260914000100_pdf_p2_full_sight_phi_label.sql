-- =============================================================================
-- PDF·P2 fix wave — QA BLOCKER-1 + MAJOR-1 (phase-PDF-P2-review), PO-ratified
-- as ADR 0104 Amendments A7/A8 (Package A + conservative PHI labeling).
--
-- A7 (full-sight conjunction): where the source domain masks content PER
-- CALLER, printed-document sight = source reach AND unmasked full-content
-- sight, at mint AND download alike. The canonical bytes are therefore always
-- the COMPLETE artifact, minter-independent; a masked caller (the respondent
-- of a linked case, or a member without read_case_deliberation where gated
-- text exists) can neither mint nor download — the same exclusion the
-- domain's screens enforce at the column-grant level.
--
-- A8 (conservative PHI labeling): an ata carrying any masked-class content
-- mints with contains_phi = true (presence-derived by the SERVER ACTION —
-- never a user choice; NOT the D9 per-mint patient-identifier choice, which
-- remains absent for meetings). The mint door's PHI gate becomes per-kind —
-- the THIRD sanctioned kind-conditional site (the registration-mirror TRIO).
--
-- Both re-emits CREATE OR REPLACE; ACL/prosecdef/proconfig property-diffed
-- old-vs-new from the catalog after apply.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The full-sight predicate (A7). MIRRORS THE LIVE MASKING TERMS of
-- app._project_meeting_agenda_item (catalog-read 2026-08-08, not file text):
--   term 1 — respondent title masking: the caller is a respondent
--     (is_case_respondent) of ANY case linked to an agenda item → that item's
--     title (the process number) would be nulled for him. Titles are NOT NULL,
--     so linkage alone masks.
--   term 2 — deliberation-gated free text: the caller lacks
--     read_case_deliberation on ANY case linked to an item WHOSE gated text is
--     PRESENT (description / discussion_notes / resolution) → those fields
--     would be nulled. Absent text nulls to a no-op — not a mask (the lead's
--     presence qualifier).
-- Un-linked agenda items mask nobody (the projection returns them whole).
-- Null uid: term 2's NOT has_case_capability(…, null) is true wherever gated
-- text exists on a linked item → masked → false (fail closed); the arm's
-- can_reach_meeting conjunct already failed on null anyway.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_full_meeting_content(
  p_meeting_id uuid,
  p_uid uuid
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select not exists (
    select 1
    from public.meeting_agenda_items ai
    where ai.meeting_id = p_meeting_id
      and (
        exists (
          select 1 from public.meeting_cases mc
          where mc.agenda_item_id = ai.id
            and app.is_case_respondent(mc.case_id, p_uid)
        )
        or (
          (ai.description is not null
            or ai.discussion_notes is not null
            or ai.resolution is not null)
          and exists (
            select 1 from public.meeting_cases mc
            where mc.agenda_item_id = ai.id
              and not app.has_case_capability(mc.case_id, p_uid, 'read_case_deliberation')
          )
        )
      )
  );
$$;

comment on function app.can_read_full_meeting_content(uuid, uuid) is
  'ADR 0104 A7: true iff NO agenda item of the meeting would be masked for '
  'this caller by app._project_meeting_agenda_item (respondent title term + '
  'deliberation-gated free text term, presence-qualified). The meeting arm of '
  'can_view_printed_document conjoins this with can_reach_meeting so the ata''s '
  'COMPLETE canonical bytes are only reachable by callers the domain shows '
  'everything to.';

revoke all on function app.can_read_full_meeting_content(uuid, uuid) from public;
grant execute on function app.can_read_full_meeting_content(uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Re-emit 1: the dispatch — meeting arm gains the A7 conjunction.
-- ---------------------------------------------------------------------------
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
      -- A7 FULL-SIGHT CONJUNCTION: reach (member AND (commission_default OR
      -- attendee); NO admin arm — C7) AND unmasked full-content sight. The
      -- canonical ata is COMPLETE and minter-independent, so a caller the
      -- projection would mask (respondent of a linked case; member without
      -- read_case_deliberation where gated text exists) is denied the bytes
      -- the column-grant layer already denies him — mint AND download (D11).
      return app.can_reach_meeting(p_source_id, p_uid)
         and app.can_read_full_meeting_content(p_source_id, p_uid);
    else
      -- case | interview arms land in P3..P4 (one per phase).
      -- ELSE_FAIL_CLOSED: an unhandled kind is UNREADABLE, not exposed
      -- (ADR 0104 D3) — a new printable kind that forgets its arm fails shut.
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Re-emit 2: the mint door — the PHI gate becomes per-kind (A8).
-- ---------------------------------------------------------------------------
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

  return v_row;
end;
$$;
