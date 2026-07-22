-- =============================================================================
-- Controlled documents: first-class `changes_requested` version status.
--
-- Today a reviewer rejection silently reverts a version to `draft` and DELETES the
-- still-pending sibling approvals. This migration promotes rejection to a real,
-- visible `changes_requested` state:
--   * `changes_requested` becomes a first-class version/header status (added to both
--     status CHECK constraints);
--   * a reviewer rejection moves `in_approval` -> `changes_requested` (NOT `draft`),
--     and KEEPS the still-pending sibling approvals so the version card can list ALL
--     originally-named approvers with their verdicts + notes;
--   * the coordinator revises the SAME version IN PLACE (no version bump): the file
--     may be re-set and the version re-submitted for approval from `changes_requested`;
--   * a re-submit still delete-then-inserts a fresh all-pending roster (unchanged).
--
-- MINOR-1 REVERSAL (security note): not deleting the pending sibling rows means an
-- originally-named still-pending approver RETAINS SELECT access (via
-- is_document_version_approver / can_read_document_of_version) to a
-- `changes_requested` version until it is resubmitted (which rebuilds the roster).
-- Accepted: controlled documents are PHI-FREE (Rule 12) and these are legitimately
-- named approvers on a version still inside the approval lifecycle.
--
-- Per-reviewer decision key stays English `rejected` (only its pt-BR LABEL changes,
-- app-side). No enum types here — status is `text` + CHECK.
-- Forward-only / additive (existing rows are all in the prior 4-value set).
-- =============================================================================

-- 1) Widen both status CHECK constraints to admit 'changes_requested'.
alter table public.controlled_documents
  drop constraint controlled_documents_status_check,
  add constraint controlled_documents_status_check
    check (status = any (array['draft', 'in_approval', 'changes_requested', 'effective', 'obsolete']));

alter table public.controlled_document_versions
  drop constraint controlled_document_versions_status_check,
  add constraint controlled_document_versions_status_check
    check (status = any (array['draft', 'in_approval', 'changes_requested', 'effective', 'obsolete']));

-- 2) decide_document_approval_core: a rejection lands the version (and the header, when
--    the version is the current one) in `changes_requested` instead of `draft`, and no
--    longer deletes the still-pending sibling rows (they keep listing the roster and
--    retain read — MINOR-1 reversal above). All other preconditions unchanged.
create or replace function app.decide_document_approval_core(p_version_id uuid, p_decision text, p_note text)
returns public.document_approvals
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_approval public.document_approvals;
  v_status text;
  v_storage text;
  v_document uuid;
  v_commission uuid;
  v_code text;
  v_title text;
  v_author uuid;
  v_hash text;
  v_ok boolean;
begin
  perform app.assert_controlled_docs_enabled();

  select v.status, v.storage_path, v.document_id, d.commission_id, d.code, d.title, d.created_by
    into v_status, v_storage, v_document, v_commission, v_code, v_title, v_author
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_document is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if v_status <> 'in_approval' then
    raise exception 'esta versão não está aguardando aprovação' using errcode = 'HC089';
  end if;

  -- Sign-own-row: the caller must be a NAMED approver on this version whose decision
  -- is still pending. (SECURITY DEFINER bypasses RLS, so we assert eligibility here --
  -- the sign_meeting discipline.)
  select * into v_approval
  from public.document_approvals
  where document_version_id = p_version_id and approver_id = v_uid;
  if v_approval.id is null then
    raise exception 'você não foi indicado como aprovador desta versão' using errcode = '42501';
  end if;
  if v_approval.decision is not null then
    raise exception 'você já registrou sua decisão nesta versão' using errcode = 'HC089';
  end if;

  -- Per-signer + per-artifact hash (lead decision (b)). storage_path is immutable
  -- (Rule 6) so it stably identifies the signed bytes.
  v_hash := encode(
    extensions.digest(coalesce(v_storage, '') || ':' || v_uid::text || ':' || p_decision, 'sha256'),
    'hex');

  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  update public.document_approvals
  set decision = p_decision,
      decided_at = now(),
      note = nullif(btrim(p_note), ''),
      signature_hash = v_hash
  where id = v_approval.id
  returning * into v_approval;

  -- A rejection moves the version (and the header, when this IS the current version)
  -- to `changes_requested` -- a first-class, visible "revise in place" state. We DO
  -- NOT delete the still-pending sibling rows (MINOR-1 reversal): the card must keep
  -- listing ALL originally-named approvers with their verdicts + notes, and the
  -- still-pending approvers retain read of the version until it is resubmitted (which
  -- rebuilds a fresh all-pending roster). Runs inside the RPC flag and AFTER the
  -- transition, so the frozen-approver-set guard (HC093) does not fire.
  if p_decision = 'rejected' then
    update public.controlled_document_versions
    set status = 'changes_requested'
    where id = p_version_id;

    update public.controlled_documents
    set status = 'changes_requested'
    where id = v_document and current_version_id = p_version_id;
  end if;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  -- Notify the document author of the decision (skip self-notify). Deep-links the
  -- document detail. is_reminder=false (an event, persists as history).
  if v_author is not null and v_author <> v_uid then
    v_ok := app.enqueue_notification(
      v_author, v_commission, 'document_approval', 'decided', false,
      'controlled_document_version', p_version_id,
      case when p_decision = 'approved'
           then 'Documento ' || v_code || ': aprovação registrada'
           else 'Documento ' || v_code || ': revisão solicitada' end,
      v_title,
      'document_approval:' || v_approval.id || ':decided'
    );
  end if;

  return v_approval;
end;
$function$;

-- 3) set_document_version_file: accept a `draft` OR `changes_requested` version (the
--    coordinator re-attaches the corrected file during in-place revision).
create or replace function public.set_document_version_file(p_version_id uuid, p_storage_path text, p_summary_of_changes_md text default null::text, p_expiry_date date default null::date)
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
  select d.commission_id, v.status into v_commission, v_status
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_commission is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  -- A rascunho OR a "com alterações solicitadas" version's file may be (re)set -- a
  -- frozen (em aprovação / vigente / obsoleto) artifact is immutable (Rule 6).
  if v_status not in ('draft', 'changes_requested') then
    raise exception 'apenas versões em rascunho ou com alterações solicitadas podem ter o arquivo alterado' using errcode = 'HC089';
  end if;

  update public.controlled_document_versions
  set storage_path = p_storage_path,
      summary_of_changes_md = nullif(btrim(p_summary_of_changes_md), ''),
      expiry_date = p_expiry_date
  where id = p_version_id
  returning * into v_row;

  return v_row;
end;
$function$;

-- 4) submit_document_for_approval: accept a `draft` OR `changes_requested` version.
--    The delete-then-insert roster rebuild + -> in_approval flip are unchanged, so a
--    re-submit from `changes_requested` yields a fresh all-pending round.
create or replace function public.submit_document_for_approval(p_version_id uuid, p_approvers jsonb, p_proposed_effective_date date default null::date, p_approval_due_date date default null::date)
returns public.controlled_document_versions
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.controlled_document_versions;
  v_commission uuid;
  v_hospital uuid;
  v_status text;
  v_storage text;
  v_code text;
  v_title text;
  v_elem jsonb;
  v_approver uuid;
  v_seen uuid[] := array[]::uuid[];
  v_count integer := 0;
  v_ok boolean;
begin
  perform app.assert_controlled_docs_enabled();
  select d.commission_id, v.status, v.storage_path, d.code, d.title
    into v_commission, v_status, v_storage, v_code, v_title
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_commission is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  if v_status not in ('draft', 'changes_requested') then
    raise exception 'apenas versões em rascunho ou com alterações solicitadas podem ser enviadas para aprovação' using errcode = 'HC089';
  end if;
  if v_storage is null then
    raise exception 'anexe o arquivo do documento antes de enviar para aprovação' using errcode = 'HC089';
  end if;
  if p_approvers is null or jsonb_typeof(p_approvers) <> 'array'
     or jsonb_array_length(p_approvers) = 0 then
    raise exception 'informe ao menos um aprovador' using errcode = 'HC089';
  end if;

  v_hospital := app.hospital_of_commission(v_commission);

  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  -- (a) Rebuild the roster: drop any prior rows, insert the fresh named set. From a
  -- `changes_requested` version this discards the previous round (including the
  -- rejected rows) and starts a fresh all-pending round.
  delete from public.document_approvals where document_version_id = p_version_id;

  for v_elem in select * from jsonb_array_elements(p_approvers) loop
    v_approver := nullif(v_elem ->> 'approver_id', '')::uuid;
    if v_approver is null then
      raise exception 'aprovador inválido' using errcode = 'HC091';
    end if;
    if v_approver = any(v_seen) then
      raise exception 'aprovador duplicado' using errcode = 'HC092';
    end if;
    if not app.is_entitled_document_approver(v_hospital, v_approver) then
      raise exception 'aprovador não pertence a este hospital ou está inativo' using errcode = 'HC091';
    end if;
    v_seen := array_append(v_seen, v_approver);

    insert into public.document_approvals (document_version_id, approver_id, approver_title)
    values (p_version_id, v_approver, nullif(btrim(v_elem ->> 'approver_title'), ''));
    v_count := v_count + 1;
  end loop;

  -- Persist the wizard's proposed effective date + reviewer-response deadline (O2)
  -- and flip the version -> em_aprovacao; mirror onto the header.
  update public.controlled_document_versions
  set status = 'in_approval',
      proposed_effective_date = p_proposed_effective_date,
      approval_due_date = p_approval_due_date
  where id = p_version_id
  returning * into v_row;

  update public.controlled_documents
  set status = 'in_approval'
  where id = v_row.document_id and current_version_id = p_version_id;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  -- Notify each named approver that the document awaits their approval (deep-links
  -- the sign page). is_reminder=false (an assignment, never suppressed). Best-effort:
  -- an OFF notifications flag / duplicate simply returns false.
  foreach v_approver in array v_seen loop
    v_ok := app.enqueue_notification(
      v_approver, v_commission, 'document_approval', 'requested', false,
      'controlled_document_version', p_version_id,
      'Documento ' || v_code || ' aguarda sua aprovação', v_title,
      'document_approval:' || p_version_id || ':' || v_approver || ':requested'
    );
  end loop;

  return v_row;
end;
$function$;

-- 4b) guard_controlled_document_status: teach the version status-machine the two new
--     legal edges (in_approval -> changes_requested on reject; changes_requested ->
--     in_approval on resubmit) AND exempt `changes_requested` from the non-status
--     immutability branch, so set_document_version_file may re-set the file on it
--     (the re-set is a plain non-status UPDATE outside the RPC flag, like a draft).
create or replace function app.guard_controlled_document_status()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_controlled_docs_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- Only a rascunho version may be deleted directly (and only inside an RPC path,
    -- e.g. a cancelled draft); published/superseded artifacts are retained (Rule 6 spirit).
    if old.status <> 'draft' and not v_in_rpc then
      raise exception 'apenas versões em rascunho podem ser removidas'
        using errcode = 'HC089';
    end if;
    return old;
  end if;

  -- UPDATE. A status change is permitted ONLY inside a controlled-docs RPC, and only
  -- along a legal edge; a non-status update on a frozen version is forbidden.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de status devem passar por uma operação de documento controlado'
        using errcode = 'HC089';
    end if;
    -- Legal edges: rascunho->em_aprovacao ;
    -- em_aprovacao->{vigente, rascunho, changes_requested} ;
    -- changes_requested->em_aprovacao (resubmit in place) ; vigente->obsoleto.
    if not (
      (old.status = 'draft'             and new.status = 'in_approval')
      or (old.status = 'in_approval'    and new.status in ('effective', 'draft', 'changes_requested'))
      or (old.status = 'changes_requested' and new.status = 'in_approval')
      or (old.status = 'effective'      and new.status = 'obsolete')
    ) then
      raise exception 'transição de status inválida (% → %)', old.status, new.status
        using errcode = 'HC089';
    end if;
    return new;
  end if;

  -- Non-status update: forbidden once the version is FROZEN (em_aprovacao/vigente/
  -- obsoleto) outside an RPC. A rascunho OR a changes_requested version stays mutable
  -- (the coordinator re-attaches the corrected file during in-place revision).
  if old.status not in ('draft', 'changes_requested') and not v_in_rpc then
    raise exception 'versões publicadas/obsoletas são imutáveis'
      using errcode = 'HC089';
  end if;

  return new;
end;
$function$;

-- 5) supersede_document: the single-open-revision guard must also count a
--    `changes_requested` sibling (an effective doc can have a rejected revision open),
--    else a second supersede would create two open revisions.
create or replace function public.supersede_document(p_document_id uuid)
returns public.controlled_document_versions
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.controlled_document_versions;
  v_commission uuid;
  v_status text;
  v_next integer;
begin
  perform app.assert_controlled_docs_enabled();
  select commission_id, status into v_commission, v_status
  from public.controlled_documents where id = p_document_id;
  if v_commission is null then
    raise exception 'documento não encontrado' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  -- Only a vigente document may be superseded (there must be an in-force version to replace).
  if v_status <> 'effective' then
    raise exception 'apenas documentos vigentes podem ser substituídos' using errcode = 'HC089';
  end if;
  -- Guard against two open revisions at once (draft / in_approval / changes_requested).
  if exists (
    select 1 from public.controlled_document_versions
    where document_id = p_document_id and status in ('draft', 'in_approval', 'changes_requested')
  ) then
    raise exception 'já existe uma versão em edição para este documento' using errcode = 'HC089';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.controlled_document_versions where document_id = p_document_id;

  insert into public.controlled_document_versions (document_id, version_number, status, created_by)
  values (p_document_id, v_next, 'draft', auth.uid())
  returning * into v_row;

  return v_row;
end;
$function$;

-- 6) list_commission_documents: an effective document's "Em revisão" derived flag must
--    also count a `changes_requested` open sibling. Documents in `changes_requested`
--    already appear (no status filter) and carry their own status chip.
create or replace function public.list_commission_documents(p_commission uuid)
returns table(id uuid, commission_id uuid, hospital_id uuid, code text, title text, doc_type text, category text, tags text[], description text, review_cycle_months integer, status text, current_version_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, current_version_number integer, effective_date date, review_due_date date, obsolete_kind text, has_open_revision boolean, approvals_signed_count integer, approvals_total_count integer)
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.is_member_of(p_commission) or app.is_commission_admin_of(p_commission)) then
    return;
  end if;

  return query
  select
    d.id,
    d.commission_id,
    c.hospital_id,
    d.code,
    d.title,
    d.doc_type,
    d.category,
    d.tags,
    d.description,
    d.review_cycle_months,
    d.status,
    d.current_version_id,
    d.created_at,
    d.updated_at,
    cv.version_number,
    cv.effective_date,
    cv.review_due_date,
    cv.obsolete_kind,
    (cv.status = 'effective' and exists (
       select 1 from public.controlled_document_versions ov
       where ov.document_id = d.id
         and ov.id <> d.current_version_id
         and ov.status in ('draft', 'in_approval', 'changes_requested')
    )) as has_open_revision,
    coalesce((
      select count(*) filter (where a.decision = 'approved')
      from public.document_approvals a
      where a.document_version_id = ia.ia_version
    ), 0)::integer as approvals_signed_count,
    coalesce((
      select count(*)
      from public.document_approvals a
      where a.document_version_id = ia.ia_version
    ), 0)::integer as approvals_total_count
  from public.controlled_documents d
  join public.commissions c on c.id = d.commission_id
  left join public.controlled_document_versions cv on cv.id = d.current_version_id
  left join lateral (
    select v.id as ia_version
    from public.controlled_document_versions v
    where v.document_id = d.id and v.status = 'in_approval'
    limit 1
  ) ia on true
  where d.commission_id = p_commission
  order by d.created_at desc;
end;
$function$;
