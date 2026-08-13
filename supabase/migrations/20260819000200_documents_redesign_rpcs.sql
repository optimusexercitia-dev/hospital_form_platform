-- =============================================================================
-- Controlled-Document Redesign (ADR 0081) — B0 (enum-key anglicization, this
-- module only) + B2 (RPC behaviour). ONE coherent pass; every edited DEFINER body
-- is RE-EMITTED from the live pg_get_functiondef (2026-07-21), NEVER from stale
-- migration text (memory: re-emit-definer-body-from-live-def) — some prior patches
-- (e.g. the reject-cleanup MINOR-1) live only in the catalog.
--
-- B0 dictionary (keys change 1:1; pt-BR LABELS unchanged — Rule 10; ADR 0069 method):
--   doc_type: politica→policy · pop→sop · protocolo→protocol · regimento→bylaws ·
--             manual→manual · outro→other
--   decision: aprovado→approved · rejeitado→rejected
-- Function-scoped replaces only — 'aprovado'/'rejeitado'/'regimento' may appear in
-- OTHER modules; this migration touches ONLY controlled-docs bodies + constraints.
--
-- B2: create/update accept p_category/p_tags; submit persists proposed/approval
-- dates + enqueues approver notifications; publish stamps the retired prior version
-- obsolete_kind='superseded', defaults p_effective_date from proposed_effective_date,
-- and notifies the author on vigente; mark_document_obsolete stamps 'retired';
-- decide-core enqueues the author on a decision.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- B0 · CHECK-constraint swaps (English keys). Reset-OK pre-pilot window → no data
-- migration (ADR 0081). Atomic with the body re-emits below (single transaction).
-- ---------------------------------------------------------------------------
alter table public.controlled_documents drop constraint controlled_documents_doc_type_check;
alter table public.controlled_documents add constraint controlled_documents_doc_type_check
  check (doc_type = any (array['policy', 'sop', 'protocol', 'bylaws', 'manual', 'other']::text[]));

alter table public.document_approvals drop constraint document_approvals_decision_check;
alter table public.document_approvals add constraint document_approvals_decision_check
  check (decision is null or decision = any (array['approved', 'rejected']::text[]));

-- ---------------------------------------------------------------------------
-- B2 · create_controlled_document — +p_category / +p_tags. Signature change ⇒
-- DROP + CREATE (create-or-replace cannot widen the arg list) ⇒ re-REVOKE/GRANT
-- (a fresh function gets PUBLIC execute by default; the prior one had none).
-- ---------------------------------------------------------------------------
drop function if exists public.create_controlled_document(uuid, text, text, integer);
create function public.create_controlled_document(
  p_commission uuid,
  p_title text,
  p_doc_type text,
  p_review_cycle_months integer default null::integer,
  p_category text default null::text,
  p_tags text[] default '{}'::text[])
 returns controlled_documents
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_doc public.controlled_documents;
  v_version public.controlled_document_versions;
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;

  insert into public.controlled_documents
    (commission_id, title, doc_type, review_cycle_months, category, tags, created_by)
  values
    (p_commission, btrim(p_title), p_doc_type, p_review_cycle_months,
     nullif(btrim(coalesce(p_category, '')), ''),
     coalesce(p_tags, '{}'::text[]),
     auth.uid())
  returning * into v_doc;

  insert into public.controlled_document_versions (document_id, version_number, status, created_by)
  values (v_doc.id, 1, 'draft', auth.uid())
  returning * into v_version;

  update public.controlled_documents
  set current_version_id = v_version.id
  where id = v_doc.id
  returning * into v_doc;

  return v_doc;
end;
$function$;
revoke all on function public.create_controlled_document(uuid, text, text, integer, text, text[]) from public;
grant execute on function public.create_controlled_document(uuid, text, text, integer, text, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B2 · update_controlled_document — +p_category / +p_tags. Signature change ⇒
-- DROP + CREATE + re-REVOKE/GRANT.
-- ---------------------------------------------------------------------------
drop function if exists public.update_controlled_document(uuid, text, text, integer);
create function public.update_controlled_document(
  p_id uuid,
  p_title text,
  p_doc_type text,
  p_review_cycle_months integer default null::integer,
  p_category text default null::text,
  p_tags text[] default '{}'::text[])
 returns controlled_documents
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
  if v_current_status is distinct from 'draft' then
    raise exception 'o documento só pode ser editado enquanto está em rascunho' using errcode = 'HC089';
  end if;

  update public.controlled_documents
  set title = btrim(p_title),
      doc_type = p_doc_type,
      review_cycle_months = p_review_cycle_months,
      category = nullif(btrim(coalesce(p_category, '')), ''),
      tags = coalesce(p_tags, '{}'::text[])
  where id = p_id
  returning * into v_doc;

  return v_doc;
end;
$function$;
revoke all on function public.update_controlled_document(uuid, text, text, integer, text, text[]) from public;
grant execute on function public.update_controlled_document(uuid, text, text, integer, text, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B2 · submit_document_for_approval — +p_proposed_effective_date /
-- +p_approval_due_date (persisted on the version) + enqueue one approver
-- notification per named approver (kind document_approval / requested → sign page).
-- Signature change ⇒ DROP + CREATE + re-REVOKE/GRANT.
-- ---------------------------------------------------------------------------
drop function if exists public.submit_document_for_approval(uuid, jsonb);
create function public.submit_document_for_approval(
  p_version_id uuid,
  p_approvers jsonb,
  p_proposed_effective_date date default null::date,
  p_approval_due_date date default null::date)
 returns controlled_document_versions
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
  if v_status <> 'draft' then
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

  -- Persist the wizard's proposed effective date + reviewer-response deadline (O2)
  -- and flip the version → em_aprovacao; mirror onto the header.
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
revoke all on function public.submit_document_for_approval(uuid, jsonb, date, date) from public;
grant execute on function public.submit_document_for_approval(uuid, jsonb, date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B2 · publish_document — same signature (CREATE OR REPLACE keeps grants).
-- Changes: 'aprovado' → 'approved' (B0); default p_effective_date from the version's
-- proposed_effective_date; stamp the retired prior vigente obsolete_kind='superseded';
-- notify the author on vigente.
-- ---------------------------------------------------------------------------
create or replace function public.publish_document(
  p_version_id uuid,
  p_effective_date date default null::date,
  p_review_due_date date default null::date,
  p_expiry_date date default null::date)
 returns controlled_document_versions
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.controlled_document_versions;
  v_commission uuid;
  v_document uuid;
  v_status text;
  v_cycle integer;
  v_pending integer;
  v_effective date;
  v_review_due date;
  v_proposed date;
  v_code text;
  v_title text;
  v_author uuid;
  v_ok boolean;
begin
  perform app.assert_controlled_docs_enabled();
  select d.commission_id, v.document_id, v.status, d.review_cycle_months,
         v.proposed_effective_date, d.code, d.title, d.created_by
    into v_commission, v_document, v_status, v_cycle,
         v_proposed, v_code, v_title, v_author
  from public.controlled_document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;
  if v_commission is null then
    raise exception 'versão não encontrada' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar documentos nesta comissão' using errcode = '42501';
  end if;
  if v_status <> 'in_approval' then
    raise exception 'apenas versões em aprovação podem ser publicadas' using errcode = 'HC089';
  end if;

  -- ALL named approvers must have decided 'approved' (any pending or rejected blocks).
  select count(*) into v_pending
  from public.document_approvals
  where document_version_id = p_version_id
    and (decision is null or decision <> 'approved');
  if v_pending > 0 then
    raise exception 'todos os aprovadores devem aprovar antes da publicação' using errcode = 'HC090';
  end if;

  -- Default the effective date from the caller, else the version's proposed date,
  -- else today (ADR 0081 B2). review_due = effective + cycle unless overridden.
  v_effective := coalesce(p_effective_date, v_proposed, current_date);
  v_review_due := coalesce(
    p_review_due_date,
    case when v_cycle is not null
         then (v_effective + make_interval(months => v_cycle))::date
         else null end);

  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  -- Retire the prior vigente version of this document (retained + downloadable),
  -- stamping it 'superseded' (a newer version published over it — ADR 0081 B2/d).
  update public.controlled_document_versions
  set status = 'obsolete',
      obsolete_kind = 'superseded'
  where document_id = v_document and status = 'effective' and id <> p_version_id;

  update public.controlled_document_versions
  set status = 'effective',
      effective_date = v_effective,
      review_due_date = v_review_due,
      expiry_date = coalesce(p_expiry_date, expiry_date)
  where id = p_version_id
  returning * into v_row;

  update public.controlled_documents
  set status = 'effective', current_version_id = p_version_id
  where id = v_document;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  -- Notify the author that their document is now vigente (skip self-notify — the
  -- publisher is often the author). Deep-links the document detail.
  if v_author is not null and v_author <> auth.uid() then
    v_ok := app.enqueue_notification(
      v_author, v_commission, 'document_approval', 'published', false,
      'controlled_document', v_document,
      'Documento ' || v_code || ' agora vigente', v_title,
      'document_approval:' || v_document || ':published:' || v_row.version_number
    );
  end if;

  return v_row;
end;
$function$;

-- ---------------------------------------------------------------------------
-- B2 · mark_document_obsolete — same signature. Stamp obsolete_kind='retired'
-- (retired without a replacement — ADR 0081 B2/d).
-- ---------------------------------------------------------------------------
create or replace function public.mark_document_obsolete(p_document_id uuid)
 returns controlled_documents
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
  if v_status <> 'effective' then
    raise exception 'apenas documentos vigentes podem ser tornados obsoletos' using errcode = 'HC089';
  end if;

  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  update public.controlled_document_versions
  set status = 'obsolete',
      obsolete_kind = 'retired'
  where id = v_current;

  update public.controlled_documents
  set status = 'obsolete'
  where id = p_document_id
  returning * into v_doc;

  perform set_config('app.in_controlled_docs_rpc', 'off', true);

  return v_doc;
end;
$function$;

-- ---------------------------------------------------------------------------
-- B0 · approve_document / reject_document — wrappers pass the decision literal;
-- anglicize aprovado→approved / rejeitado→rejected. Same signature.
-- ---------------------------------------------------------------------------
create or replace function public.approve_document(p_version_id uuid, p_note text default null::text)
 returns document_approvals
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  return app.decide_document_approval_core(p_version_id, 'approved', p_note);
end;
$function$;

create or replace function public.reject_document(p_version_id uuid, p_note text default null::text)
 returns document_approvals
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  return app.decide_document_approval_core(p_version_id, 'rejected', p_note);
end;
$function$;

-- ---------------------------------------------------------------------------
-- B0 + B2 · app.decide_document_approval_core — the sign-own-row core.
-- B0: 'rejeitado' → 'rejected'. B2: notify the document author on a decision
-- (kind document_approval / decided → document detail).
-- ---------------------------------------------------------------------------
create or replace function app.decide_document_approval_core(p_version_id uuid, p_decision text, p_note text)
 returns document_approvals
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
  -- approver-read arm. We KEEP the rejected row (it is the decision record + carries
  -- the note; the rejecting approver retaining read of what they reviewed is defensible
  -- custody). A subsequent resubmit still delete-then-inserts a fresh roster (unchanged).
  -- Runs inside the RPC flag (app.in_controlled_docs_rpc='on') and AFTER the transition
  -- to rascunho, so the frozen-approver-set guard (HC093) does not fire.
  if p_decision = 'rejected' then
    update public.controlled_document_versions
    set status = 'draft'
    where id = p_version_id;

    update public.controlled_documents
    set status = 'draft'
    where id = v_document and current_version_id = p_version_id;

    delete from public.document_approvals
    where document_version_id = p_version_id
      and decision is null;                 -- drop the still-pending siblings; keep rejected
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

-- ---------------------------------------------------------------------------
-- B0 (keystone 2 — commission_charters coupling) · upsert_commission_charter
-- filters the linked doc by doc_type; 'regimento' → 'bylaws'. Re-emitted from the
-- live body; only the value literal changes (pt-BR prose + the 'has_regimento' API
-- key are unchanged). Same signature ⇒ grants preserved.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_commission_charter(p_commission uuid, p_meeting_frequency text, p_controlled_document_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_row public.commission_charters;
begin
  perform app.assert_charters_enabled();

  -- Authority FIRST — staff_admin of THIS commission (not org/hospital admin).
  if not app.is_staff_admin_of(p_commission) then
    raise exception 'apenas a coordenação da comissão pode configurar o regimento e a cadência'
      using errcode = 'HC0K0';
  end if;

  -- Then the regimento link: a same-commission doc_type='bylaws' controlled document
  -- ('bylaws' is the B0-anglicized key for the pt-BR "regimento" — ADR 0081).
  if p_controlled_document_id is not null then
    if not exists (
      select 1 from public.controlled_documents d
      where d.id = p_controlled_document_id
        and d.commission_id = p_commission
        and d.doc_type = 'bylaws'
    ) then
      raise exception 'o documento selecionado não é um regimento válido desta comissão'
        using errcode = 'HC0K1';
    end if;
  end if;

  insert into public.commission_charters
    (commission_id, meeting_frequency, controlled_document_id, created_by)
  values
    (p_commission, p_meeting_frequency, p_controlled_document_id, v_uid)
  on conflict (commission_id) do update
    set meeting_frequency      = excluded.meeting_frequency,
        controlled_document_id = excluded.controlled_document_id
        -- created_by intentionally NOT updated (set on insert only)
  returning * into v_row;

  -- Audit (Rule 11) — config-level metadata only, PHI-free (Rule 12).
  perform app.audit_write(
    'charter.upserted', 'commission', p_commission, p_commission,
    'Regimento e cadência atualizados',
    jsonb_build_object(
      'meeting_frequency', v_row.meeting_frequency,
      'has_regimento', (v_row.controlled_document_id is not null)
    )
  );

  return jsonb_build_object(
    'commissionId',         v_row.commission_id,
    'meetingFrequency',     v_row.meeting_frequency,
    'controlledDocumentId', v_row.controlled_document_id,
    'createdBy',            v_row.created_by,
    'createdAt',            v_row.created_at,
    'updatedAt',            v_row.updated_at
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- B0 · app.trg_audit_document_approvals branches on the decision value; anglicize
-- 'aprovado'→'approved' / 'rejeitado'→'rejected'. Re-emitted from the live body;
-- only the comparison literals change (pt-BR audit descriptions unchanged).
-- ---------------------------------------------------------------------------
create or replace function app.trg_audit_document_approvals()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  c_cols constant text[] := array['decision'];   -- decision ONLY; never note/hash/title.
  v_commission uuid;
  v_version uuid := coalesce(new.document_version_id, old.document_version_id);
begin
  v_commission := app.commission_of_document_version(v_version);
  if v_commission is null then
    return null;  -- version gone (cascade); nothing to attribute.
  end if;

  if tg_op = 'INSERT' then
    perform app.audit_write('document_approval.requested', 'document_approval', new.id, v_commission,
      'Aprovação solicitada',
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    if new.decision is distinct from old.decision and new.decision = 'approved' then
      perform app.audit_write('document_approval.signed', 'document_approval', new.id, v_commission,
        'Documento aprovado (assinatura registrada)',
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    elsif new.decision is distinct from old.decision and new.decision = 'rejected' then
      perform app.audit_write('document_approval.rejected', 'document_approval', new.id, v_commission,
        'Documento rejeitado',
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    else
      perform app.audit_write('document_approval.updated', 'document_approval', new.id, v_commission,
        'Aprovação atualizada',
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    end if;
  elsif tg_op = 'DELETE' then
    perform app.audit_write('document_approval.removed', 'document_approval', old.id, v_commission,
      'Aprovação removida',
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$function$;
