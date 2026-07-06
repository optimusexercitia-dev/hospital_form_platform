-- =============================================================================
-- Phase 17 — Controlled-Document Lifecycle · B3
-- Read RPCs: documents_due_for_review (commission — controlled docs + overdue
-- published form versions) and hospital_document_register (PHI-free institution-wide
-- register, gated is_admin/is_hospital_admin_of/org-admin — the nsp_org_* pattern).
-- Both SECURITY DEFINER, gated, search_path pinned; metadata-only (no Markdown/paths).
--
-- Plan §B3. REVOKE ALL FROM PUBLIC then GRANT on every new public.* RPC (the
-- dashboard t19 pgTAP guard fails otherwise — memory new-public-rpc-revoke-from-public).
-- Additive, forward-only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · documents_due_for_review(commission) — the review-due list for a commission:
--     the DOCUMENT arm (vigente controlled-document versions with a review_due_date)
--     PLUS the FORM arm (published form_versions with a B4 review_due_date). Overdue
--     forms join the same list. Member/commission-admin readable.
-- -----------------------------------------------------------------------------
create or replace function public.documents_due_for_review(p_commission uuid)
  returns table (
    source_kind text,
    document_id uuid,
    form_version_id uuid,
    code text,
    title text,
    commission_id uuid,
    commission_name text,
    review_due_date date,
    is_overdue boolean)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_name text;
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.is_member_of(p_commission) or app.is_commission_admin_of(p_commission)) then
    return;
  end if;

  select name into v_commission_name from public.commissions where id = p_commission;

  return query
  -- DOCUMENT arm: the current vigente version of each document with a review_due_date.
  select
    'document'::text,
    d.id,
    null::uuid,
    d.code,
    d.title,
    d.commission_id,
    v_commission_name,
    v.review_due_date,
    (v.review_due_date < current_date) as is_overdue
  from public.controlled_documents d
  join public.controlled_document_versions v on v.id = d.current_version_id
  where d.commission_id = p_commission
    and v.status = 'vigente'
    and v.review_due_date is not null

  union all

  -- FORM arm: published form versions carrying a B4 review_due_date (a form treated
  -- as a controlled document). code = 'FORM-v<n>'; title = the form title.
  select
    'form'::text,
    null::uuid,
    fv.id,
    'FORM-v' || fv.version_number,
    f.title,
    f.commission_id,
    v_commission_name,
    fv.review_due_date,
    (fv.review_due_date < current_date) as is_overdue
  from public.form_versions fv
  join public.forms f on f.id = fv.form_id
  where f.commission_id = p_commission
    and fv.status = 'published'
    and fv.review_due_date is not null

  order by review_due_date nulls last;
end;
$$;
alter function public.documents_due_for_review(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 2 · hospital_document_register(hospital, filters) — PHI-free institution-wide
--     register across the hospital's commissions. Gated is_admin OR is_hospital_admin_of
--     OR org_admin-of-the-hospital's-org (the indicators Q3 rollup gate). Metadata
--     only — NO summary_of_changes_md / storage_path. Optional type/status/overdue filters.
-- -----------------------------------------------------------------------------
create or replace function public.hospital_document_register(
  p_hospital uuid,
  p_doc_type text default null,
  p_status text default null,
  p_review_overdue_only boolean default false)
  returns table (
    document_id uuid,
    commission_id uuid,
    commission_name text,
    code text,
    title text,
    doc_type text,
    status text,
    current_version_number integer,
    effective_date date,
    review_due_date date,
    is_review_overdue boolean)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_controlled_docs_enabled();
  if not (app.is_admin()
          or app.is_hospital_admin_of(p_hospital)
          or app.is_org_admin_of(app.org_of_hospital(p_hospital))) then
    return;
  end if;

  return query
  select
    d.id,
    d.commission_id,
    c.name,
    d.code,
    d.title,
    d.doc_type,
    d.status,
    v.version_number,
    v.effective_date,
    v.review_due_date,
    (v.review_due_date is not null and v.review_due_date < current_date) as is_review_overdue
  from public.controlled_documents d
  join public.commissions c on c.id = d.commission_id
  left join public.controlled_document_versions v on v.id = d.current_version_id
  where c.hospital_id = p_hospital
    and (p_doc_type is null or d.doc_type = p_doc_type)
    and (p_status is null or d.status = p_status)
    and (not p_review_overdue_only
         or (v.review_due_date is not null and v.review_due_date < current_date))
  order by c.name, d.code;
end;
$$;
alter function public.hospital_document_register(uuid, text, text, boolean) owner to postgres;

-- -----------------------------------------------------------------------------
-- 3 · list_approver_candidates(commission) — the submit-for-approval picker source:
--     "any ACTIVE same-hospital user" (ADR 0057), callable by a staff_admin/coordinator
--     of THIS commission (not necessarily a hospital_admin). Minimum-necessary fields —
--     id + display name + a role label; NO email, NO PHI. Cross-commission enumeration
--     kept tight to the gate + those fields.
-- -----------------------------------------------------------------------------
create or replace function public.list_approver_candidates(p_commission uuid)
  returns table (id uuid, name text, title text)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_hospital uuid;
begin
  perform app.assert_controlled_docs_enabled();
  v_hospital := app.hospital_of_commission(p_commission);
  if v_hospital is null then
    return;
  end if;
  -- Gate: a coordinator of THIS commission, a hospital_admin of its hospital, or admin.
  if not (app.is_staff_admin_of(p_commission)
          or app.is_commission_admin_of(p_commission)
          or app.is_hospital_admin_of(v_hospital)
          or app.is_admin()) then
    return;
  end if;

  return query
  with hospital_users as (
    -- Distinct active users who are members of ANY commission in this hospital.
    select distinct cm.user_id
    from public.commission_members cm
    join public.commissions c on c.id = cm.commission_id
    where c.hospital_id = v_hospital
  )
  select
    p.id,
    p.full_name,
    -- Role label (highest role held) — a DISPLAY HINT only, not authority. hospital_admin
    -- of this hospital / org_admin of its org → "Administração"; staff_admin in any of the
    -- hospital's commissions → "Coordenador(a)"; otherwise "Membro". (org_admin rows carry
    -- hospital_id NULL — matched via the org, not the hospital_id column.)
    case
      when exists (
        select 1 from public.organization_members om
        where om.user_id = p.id
          and (
            (om.role = 'hospital_admin' and om.hospital_id = v_hospital)
            or (om.role = 'org_admin' and om.organization_id = app.org_of_hospital(v_hospital))
          )
      ) then 'Administração'
      when exists (
        select 1 from public.commission_members cm
        join public.commissions c on c.id = cm.commission_id
        where cm.user_id = p.id and c.hospital_id = v_hospital and cm.role = 'staff_admin'
      ) then 'Coordenador(a)'
      else 'Membro'
    end::text as title
  from hospital_users hu
  join public.profiles p on p.id = hu.user_id
  where p.is_active = true
  order by p.full_name;
end;
$$;
alter function public.list_approver_candidates(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 4 · t19 grant hygiene.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn text;
  v_sigs text[] := array[
    'public.documents_due_for_review(uuid)',
    'public.hospital_document_register(uuid, text, text, boolean)',
    'public.list_approver_candidates(uuid)'
  ];
begin
  foreach v_fn in array v_sigs loop
    execute format('revoke all on function %s from public', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;
end $$;
