-- =============================================================================
-- Phase 17 — Controlled-Document Lifecycle · B2
-- Lifecycle RPCs. All writes flow through these SECURITY DEFINER functions (posture
-- (b) — the tables have no direct write grant). Authoring (create/update/add-version/
-- submit/publish/supersede/obsolete) gates is_staff_admin_of OR is_commission_admin_of;
-- approve/reject are SIGN-OWN-ROW (only the named, entitled, still-pending approver).
-- Status writes are wrapped in the app.in_controlled_docs_rpc session flag so the B1
-- state-machine + frozen-approver-set guards permit them.
--
-- LEAD-DECIDED semantics (folded in):
--   (a) submit = DELETE-then-INSERT the approval set (first submit AND resubmit-after-
--       reject, both from rascunho) — prevents a removed approver retaining a read grant.
--   (b) signature_hash = sha256(storage_path : approver_id : decision) — per-signer +
--       per-artifact (non-transferable), mirroring meeting_signatures.content_hash.
--
-- SQLSTATEs: HC089 wrong-state · HC090 publish-with-pending/rejected · HC091 approver-
-- not-entitled (foreign-hospital/inactive) · HC092 duplicate-approver · HC093 frozen-
-- approver-set (raised by the B1 guard). pt-BR messages (Rule 10). Additive, forward-only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · Approver-entitlement helper: an approver must be an ACTIVE user who is a
--     member of at least one commission in the SAME hospital as the document.
--     (Any active same-hospital user — the institutional-signer case, e.g. the
--     technical director / quality office — not necessarily a member of THIS
--     commission.) SECURITY DEFINER so it can read commission_members + profiles.
-- -----------------------------------------------------------------------------
create or replace function app.is_entitled_document_approver(p_hospital uuid, p_user uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_active(p_user) and exists (
    select 1
    from public.commission_members cm
    join public.commissions c on c.id = cm.commission_id
    where cm.user_id = p_user and c.hospital_id = p_hospital
  );
$$;
alter function app.is_entitled_document_approver(uuid, uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 1 · create_controlled_document — header + an initial rascunho version (no file
--     yet; the file lands via add_document_version's upload). Mints DOC-####.
-- -----------------------------------------------------------------------------
create or replace function public.create_controlled_document(
  p_commission uuid,
  p_title text,
  p_doc_type text,
  p_review_cycle_months integer default null)
  returns public.controlled_documents language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_doc public.controlled_documents;
  v_version public.controlled_document_versions;
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;

  insert into public.controlled_documents (commission_id, title, doc_type, review_cycle_months, created_by)
  values (p_commission, btrim(p_title), p_doc_type, p_review_cycle_months, auth.uid())
  returning * into v_doc;

  insert into public.controlled_document_versions (document_id, version_number, status, created_by)
  values (v_doc.id, 1, 'rascunho', auth.uid())
  returning * into v_version;

  update public.controlled_documents
  set current_version_id = v_version.id
  where id = v_doc.id
  returning * into v_doc;

  return v_doc;
end;
$$;
alter function public.create_controlled_document(uuid, text, text, integer) owner to postgres;

-- -----------------------------------------------------------------------------
-- 2 · update_controlled_document — header metadata (title/doc_type/review cycle).
--     Never touches status/version (those are lifecycle RPCs).
-- -----------------------------------------------------------------------------
create or replace function public.update_controlled_document(
  p_id uuid,
  p_title text,
  p_doc_type text,
  p_review_cycle_months integer default null)
  returns public.controlled_documents language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_doc public.controlled_documents;
  v_commission uuid;
  v_current_status text;
begin
  perform app.assert_controlled_docs_enabled();
  select d.commission_id, cv.status
    into v_commission, v_current_status
  from public.controlled_documents d
  left join public.controlled_document_versions cv on cv.id = d.current_version_id
  where d.id = p_id;
  if v_commission is null then
    raise exception 'documento não encontrado' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  -- Header metadata is editable ONLY while the current version is a rascunho (lead #D):
  -- once the document is em_aprovacao/vigente/obsoleto the header is frozen with the
  -- artifact. HC089 wrong-state otherwise.
  if v_current_status is distinct from 'rascunho' then
    raise exception 'o documento só pode ser editado enquanto está em rascunho' using errcode = 'HC089';
  end if;

  update public.controlled_documents
  set title = btrim(p_title), doc_type = p_doc_type, review_cycle_months = p_review_cycle_months
  where id = p_id
  returning * into v_doc;

  return v_doc;
end;
$$;
alter function public.update_controlled_document(uuid, text, text, integer) owner to postgres;

-- -----------------------------------------------------------------------------
-- 3 · add_document_version — record a NEW rascunho version whose storage_path was
--     already uploaded to a NEW immutable object (Rule 6). Only valid when the
--     current version is NOT rascunho (a rascunho is edited in place via
--     set_document_version_file); primarily used by supersede. Callable to attach a
--     file to the initial version too. Returns the version row.
-- -----------------------------------------------------------------------------
create or replace function public.set_document_version_file(
  p_version_id uuid,
  p_storage_path text,
  p_summary_of_changes_md text default null,
  p_expiry_date date default null)
  returns public.controlled_document_versions language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
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
  -- Only a rascunho version's file may be (re)set — a frozen artifact is immutable (Rule 6).
  if v_status <> 'rascunho' then
    raise exception 'apenas versões em rascunho podem ter o arquivo alterado' using errcode = 'HC089';
  end if;

  update public.controlled_document_versions
  set storage_path = p_storage_path,
      summary_of_changes_md = nullif(btrim(p_summary_of_changes_md), ''),
      expiry_date = p_expiry_date
  where id = p_version_id
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.set_document_version_file(uuid, text, text, date) owner to postgres;

-- -----------------------------------------------------------------------------
-- 4 · submit_document_for_approval — rascunho → em_aprovacao, naming approvers.
--     DELETE-then-INSERT the approval set (lead decision (a)). Each approver must be
--     an ACTIVE same-hospital user (HC091); no duplicates in the passed set (HC092).
--     The pending rows GRANT READ. Runs under the RPC flag so the guards permit both
--     the status flip AND the roster rebuild.
--
--     p_approvers: jsonb array of { "approver_id": uuid, "approver_title": text? }.
-- -----------------------------------------------------------------------------
create or replace function public.submit_document_for_approval(
  p_version_id uuid,
  p_approvers jsonb)
  returns public.controlled_document_versions language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.controlled_document_versions;
  v_commission uuid;
  v_hospital uuid;
  v_status text;
  v_storage text;
  v_elem jsonb;
  v_approver uuid;
  v_seen uuid[] := array[]::uuid[];
  v_count integer := 0;
begin
  perform app.assert_controlled_docs_enabled();
  select d.commission_id, v.status, v.storage_path into v_commission, v_status, v_storage
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_commission is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'apenas versões em rascunho podem ser enviadas para aprovação' using errcode = 'HC089';
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

  -- (a) Rebuild the roster: drop any prior rows, insert the fresh named set.
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

  -- Flip the version → em_aprovacao and mirror onto the header.
  update public.controlled_document_versions
  set status = 'em_aprovacao'
  where id = p_version_id
  returning * into v_row;

  update public.controlled_documents
  set status = 'em_aprovacao'
  where id = v_row.document_id and current_version_id = p_version_id;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  return v_row;
end;
$$;
alter function public.submit_document_for_approval(uuid, jsonb) owner to postgres;

-- -----------------------------------------------------------------------------
-- 5 · Sign-own-row core (approve/reject share the body). Only the NAMED, still-
--     PENDING approver (the caller) may decide. Computes the per-signer hash. A
--     rejeitado returns the version to rascunho with the note.
-- -----------------------------------------------------------------------------
create or replace function app.decide_document_approval_core(
  p_version_id uuid, p_decision text, p_note text)
  returns public.document_approvals language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_approval public.document_approvals;
  v_status text;
  v_storage text;
  v_document uuid;
  v_hash text;
begin
  perform app.assert_controlled_docs_enabled();

  select v.status, v.storage_path, v.document_id into v_status, v_storage, v_document
  from public.controlled_document_versions v where v.id = p_version_id;
  if v_document is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if v_status <> 'em_aprovacao' then
    raise exception 'esta versão não está aguardando aprovação' using errcode = 'HC089';
  end if;

  -- Sign-own-row: the caller must be a NAMED approver on this version whose decision
  -- is still pending. (SECURITY DEFINER bypasses RLS, so we assert eligibility here —
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

  -- A rejection returns the version to rascunho (corrected in place); the note carries
  -- the reason. Then DELETE the sibling PENDING rows (MINOR-1): once the version is a
  -- private rascunho again, a still-pending approver must NOT keep read access via the
  -- approver-read arm. We KEEP the rejeitado row (it is the decision record + carries
  -- the note; the rejecting approver retaining read of what they reviewed is defensible
  -- custody). A subsequent resubmit still delete-then-inserts a fresh roster (unchanged).
  -- Runs inside the RPC flag (app.in_controlled_docs_rpc='on') and AFTER the transition
  -- to rascunho, so the frozen-approver-set guard (HC093) does not fire.
  if p_decision = 'rejeitado' then
    update public.controlled_document_versions
    set status = 'rascunho'
    where id = p_version_id;

    update public.controlled_documents
    set status = 'rascunho'
    where id = v_document and current_version_id = p_version_id;

    delete from public.document_approvals
    where document_version_id = p_version_id
      and decision is null;                 -- drop the still-pending siblings; keep rejeitado
  end if;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  return v_approval;
end;
$$;
alter function app.decide_document_approval_core(uuid, text, text) owner to postgres;

create or replace function public.approve_document(p_version_id uuid, p_note text default null)
  returns public.document_approvals language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  return app.decide_document_approval_core(p_version_id, 'aprovado', p_note);
end;
$$;
alter function public.approve_document(uuid, text) owner to postgres;

create or replace function public.reject_document(p_version_id uuid, p_note text default null)
  returns public.document_approvals language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  return app.decide_document_approval_core(p_version_id, 'rejeitado', p_note);
end;
$$;
alter function public.reject_document(uuid, text) owner to postgres;

-- -----------------------------------------------------------------------------
-- 6 · publish_document — em_aprovacao → vigente. Requires ALL named approvers
--     'aprovado' (else HC090). Sets effective_date; computes review_due_date =
--     effective + review_cycle_months unless overridden; retires the prior vigente
--     version (→ obsoleto, retained + downloadable); repoints the header.
-- -----------------------------------------------------------------------------
create or replace function public.publish_document(
  p_version_id uuid,
  p_effective_date date default null,
  p_review_due_date date default null,
  p_expiry_date date default null)
  returns public.controlled_document_versions language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.controlled_document_versions;
  v_commission uuid;
  v_document uuid;
  v_status text;
  v_cycle integer;
  v_pending integer;
  v_effective date;
  v_review_due date;
begin
  perform app.assert_controlled_docs_enabled();
  select d.commission_id, v.document_id, v.status, d.review_cycle_months
    into v_commission, v_document, v_status, v_cycle
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_commission is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  if v_status <> 'em_aprovacao' then
    raise exception 'apenas versões em aprovação podem ser publicadas' using errcode = 'HC089';
  end if;

  -- ALL named approvers must have decided 'aprovado' (any pending or rejeitado blocks).
  select count(*) into v_pending
  from public.document_approvals
  where document_version_id = p_version_id
    and (decision is null or decision <> 'aprovado');
  if v_pending > 0 then
    raise exception 'todos os aprovadores devem aprovar antes da publicação' using errcode = 'HC090';
  end if;

  v_effective := coalesce(p_effective_date, current_date);
  v_review_due := coalesce(
    p_review_due_date,
    case when v_cycle is not null
         then (v_effective + make_interval(months => v_cycle))::date
         else null end);

  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  -- Retire the prior vigente version of this document (retained + downloadable).
  update public.controlled_document_versions
  set status = 'obsoleto'
  where document_id = v_document and status = 'vigente' and id <> p_version_id;

  update public.controlled_document_versions
  set status = 'vigente',
      effective_date = v_effective,
      review_due_date = v_review_due,
      expiry_date = coalesce(p_expiry_date, expiry_date)
  where id = p_version_id
  returning * into v_row;

  update public.controlled_documents
  set status = 'vigente', current_version_id = p_version_id
  where id = v_document;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  return v_row;
end;
$$;
alter function public.publish_document(uuid, date, date, date) owner to postgres;

-- -----------------------------------------------------------------------------
-- 7 · supersede_document — create the NEXT rascunho version (a fresh draft to be
--     uploaded + submitted). The prior vigente stays in force until the new one
--     publishes, at which point publish_document retires it → obsoleto. Returns the
--     new version.
-- -----------------------------------------------------------------------------
create or replace function public.supersede_document(p_document_id uuid)
  returns public.controlled_document_versions language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
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
  if v_status <> 'vigente' then
    raise exception 'apenas documentos vigentes podem ser substituídos' using errcode = 'HC089';
  end if;
  -- Guard against two open drafts at once.
  if exists (
    select 1 from public.controlled_document_versions
    where document_id = p_document_id and status in ('rascunho', 'em_aprovacao')
  ) then
    raise exception 'já existe uma versão em edição para este documento' using errcode = 'HC089';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.controlled_document_versions where document_id = p_document_id;

  insert into public.controlled_document_versions (document_id, version_number, status, created_by)
  values (p_document_id, v_next, 'rascunho', auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.supersede_document(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 8 · mark_document_obsolete — retire the current vigente version without a
--     replacement. The version is retained + downloadable; the header mirrors obsoleto.
-- -----------------------------------------------------------------------------
create or replace function public.mark_document_obsolete(p_document_id uuid)
  returns public.controlled_documents language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_doc public.controlled_documents;
  v_commission uuid;
  v_status text;
  v_current uuid;
begin
  perform app.assert_controlled_docs_enabled();
  select commission_id, status, current_version_id into v_commission, v_status, v_current
  from public.controlled_documents where id = p_document_id;
  if v_commission is null then
    raise exception 'documento não encontrado' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  if v_status <> 'vigente' then
    raise exception 'apenas documentos vigentes podem ser tornados obsoletos' using errcode = 'HC089';
  end if;

  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  update public.controlled_document_versions
  set status = 'obsoleto'
  where id = v_current;

  update public.controlled_documents
  set status = 'obsoleto'
  where id = p_document_id
  returning * into v_doc;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  return v_doc;
end;
$$;
alter function public.mark_document_obsolete(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 9 · t19 grant hygiene — REVOKE ALL FROM PUBLIC then GRANT authenticated/service_role
--     on every new public.* RPC (the dashboard t19 pgTAP guard fails otherwise).
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn text;
  v_sigs text[] := array[
    'public.create_controlled_document(uuid, text, text, integer)',
    'public.update_controlled_document(uuid, text, text, integer)',
    'public.set_document_version_file(uuid, text, text, date)',
    'public.submit_document_for_approval(uuid, jsonb)',
    'public.approve_document(uuid, text)',
    'public.reject_document(uuid, text)',
    'public.publish_document(uuid, date, date, date)',
    'public.supersede_document(uuid)',
    'public.mark_document_obsolete(uuid)'
  ];
begin
  foreach v_fn in array v_sigs loop
    execute format('revoke all on function %s from public', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;
end $$;
