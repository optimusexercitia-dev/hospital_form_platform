-- =============================================================================
-- Controlled-Document Redesign (ADR 0081) — Wave 2.5a: additive follow-up.
--   • controlled_documents.description (free-text metadata; overwrite semantics).
--   • create_/update_controlled_document accept p_description (re-emitted from LIVE
--     pg_get_functiondef — the Wave-1 category/tags bodies; +p_description only).
--   • list_commission_documents — a DEFINER register read that computes the register
--     KPI/mini-bar facts DB-side (has_open_revision + in_approval approval counts),
--     removing the FE N+1. Mirrors the member-read RLS predicate exactly.
-- Additive + forward-only. description is metadata (like title) → OUT of the audit
-- payload (the trg_audit_controlled_documents c_cols allow-list already excludes it;
-- a description-only update still emits a 'document.updated' row).
-- =============================================================================

alter table public.controlled_documents
  add column if not exists description text;

comment on column public.controlled_documents.description is
  'Free-text description (ADR 0081 Wave 2.5a). Low-sensitivity metadata — kept out of the audit payload. Overwrite semantics (the FE always posts the current value).';

-- ---------------------------------------------------------------------------
-- create_controlled_document — +p_description. Signature change ⇒ DROP+CREATE+re-grant.
-- ---------------------------------------------------------------------------
drop function if exists public.create_controlled_document(uuid, text, text, integer, text, text[]);
create function public.create_controlled_document(
  p_commission uuid,
  p_title text,
  p_doc_type text,
  p_review_cycle_months integer default null::integer,
  p_category text default null::text,
  p_tags text[] default '{}'::text[],
  p_description text default null::text)
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
    (commission_id, title, doc_type, review_cycle_months, category, tags, description, created_by)
  values
    (p_commission, btrim(p_title), p_doc_type, p_review_cycle_months,
     nullif(btrim(coalesce(p_category, '')), ''),
     coalesce(p_tags, '{}'::text[]),
     nullif(btrim(coalesce(p_description, '')), ''),
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
revoke all on function public.create_controlled_document(uuid, text, text, integer, text, text[], text) from public;
grant execute on function public.create_controlled_document(uuid, text, text, integer, text, text[], text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- update_controlled_document — +p_description. Signature change ⇒ DROP+CREATE+re-grant.
-- ---------------------------------------------------------------------------
drop function if exists public.update_controlled_document(uuid, text, text, integer, text, text[]);
create function public.update_controlled_document(
  p_id uuid,
  p_title text,
  p_doc_type text,
  p_review_cycle_months integer default null::integer,
  p_category text default null::text,
  p_tags text[] default '{}'::text[],
  p_description text default null::text)
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
      tags = coalesce(p_tags, '{}'::text[]),
      description = nullif(btrim(coalesce(p_description, '')), '')
  where id = p_id
  returning * into v_doc;

  return v_doc;
end;
$function$;
revoke all on function public.update_controlled_document(uuid, text, text, integer, text, text[], text) from public;
grant execute on function public.update_controlled_document(uuid, text, text, integer, text, text[], text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- list_commission_documents — the register read with DB-side KPI/mini-bar facts.
-- Gated on the SAME predicate as the member-read RLS (is_member_of OR
-- is_commission_admin_of); returns nothing otherwise. Computes, per document:
--   • has_open_revision — the current version is 'effective' AND a sibling
--     draft/in_approval version exists (the derived "Em revisão").
--   • approvals_signed/total — over THE in_approval version of the document (the
--     unique open-approval version, whether or not it is the current version), so
--     the mini-bar is correct for both a first-time in_approval doc and a superseded
--     doc whose new version is under approval. 0 when none is in approval.
-- NEW public RPC ⇒ REVOKE ALL FROM PUBLIC before GRANT (t19 guard).
-- ---------------------------------------------------------------------------
create or replace function public.list_commission_documents(p_commission uuid)
 returns table(
   id uuid,
   commission_id uuid,
   hospital_id uuid,
   code text,
   title text,
   doc_type text,
   category text,
   tags text[],
   description text,
   review_cycle_months integer,
   status text,
   current_version_id uuid,
   created_at timestamptz,
   updated_at timestamptz,
   current_version_number integer,
   effective_date date,
   review_due_date date,
   obsolete_kind text,
   has_open_revision boolean,
   approvals_signed_count integer,
   approvals_total_count integer)
 language plpgsql
 stable
 security definer
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
         and ov.status in ('draft', 'in_approval')
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

revoke all on function public.list_commission_documents(uuid) from public;
grant execute on function public.list_commission_documents(uuid) to authenticated, service_role;
