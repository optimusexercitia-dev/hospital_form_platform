-- =============================================================================
-- DM3 · M2 — the authorization arm: `controlled_document` joins the kernel
-- dispatch in `app.can_read_document` / `app.can_write_document`.
--
-- ADR 0114 D6/D13; plan docs/plans/dm3-controlled-documents-plan.md §3 M2, §5.
--
-- ⚠ CREATE OR REPLACE, NOT DROP+CREATE — deliberately. Both functions carry an
-- explicit ACL (postgres/authenticated/service_role, PUBLIC revoked); a
-- DROP+CREATE would restore the Postgres default and silently re-grant PUBLIC.
-- The identity (name + argtypes) is unchanged, so REPLACE is legal here.
--
-- ⚠ NAME COLLISION, the highest-probability defect source in DM3. Two families
-- share the `document` noun. Each call below names the table it reads:
--   app.can_read_document        → public.documents            (CORE)
--   app.is_document_approver_of  → public.document_approvals
--                                  ⋈ public.controlled_document_versions
--                                                              (CONTROLLED)
-- `app.commission_of_document` is the CONTROLLED helper and is deliberately NOT
-- used here: the kernel already holds the commission from securable_resources.
--
-- THE APPROVER ARM. Byte access today runs through the storage policy
-- `controlled_documents_obj_select_member` → `app.can_read_document_object`,
-- which is "member of foldername[1] OR approver on foldername[2]". M5 deletes
-- that policy. If the approver half is not re-expressed HERE, a cross-commission
-- reviewer silently loses access to the document he is being asked to approve.
-- Pinned by DM3·A3 (observed RED before this migration), with DM3·A2b proving
-- the arm is scoped to THIS document rather than a blanket approver grant.
--
-- The D15 ceiling block below is UNTOUCHED. A controlled-document home cannot
-- carry an enforcing label (app.guard_document_confidentiality raises HC0D6 for
-- any home type not in ('case','interview')), and if one ever existed the
-- kernel's `v_case is null` backstop denies it. Two barriers, same direction.
-- =============================================================================

create or replace function app.can_read_document(p_document_id uuid, p_uid uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
  v_conf text;
  v_case uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id, d.confidentiality_level
    into v_resource, v_type, v_commission, v_conf
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;
  if not (case v_type
    when 'case' then app.can_read_case(v_resource, p_uid)
    when 'meeting' then app.is_member_of_for(v_commission, p_uid)
    when 'interview' then app.can_read_interview(v_resource, p_uid)
    when 'action_item' then app.can_read_action_item(v_resource, p_uid)
    -- DM3 Wave B: the owning commission's members, PLUS the entitled approver
    -- corridor inherited from the retiring bucket policy. v_resource IS the
    -- controlled_documents.id (shared-PK registry link, ADR 0114 D4).
    when 'controlled_document' then
      app.is_member_of_for(v_commission, p_uid)
      or app.is_document_approver_of(v_resource, p_uid)
    else false
  end) then
    return false;
  end if;
  -- D15 ceiling (ADR 0114 Amendment 1; ADR 0072 D7 semantics): the two
  -- enforcing labels gate ABOVE home-resource read, as an AND-conjunct.
  -- Clearance = case_access_grants.max_confidentiality via the surviving
  -- app.confidentiality_clearance_ok (reused, never reimplemented).
  if v_conf in ('legal_privileged', 'credentialing_sensitive') then
    v_case := case v_type
      when 'case' then v_resource
      when 'interview' then app.case_of_interview(v_resource)
      else null
    end;
    if v_case is null then
      -- Fail-closed backstop: an enforcing label with no clearance plane is
      -- readable by NO ONE. Unrepresentable while the S1 seam guard stands;
      -- this arm governs any bypass and any future home type until the
      -- Phase-19 access plane (D16) absorbs the column. DM3 note: a
      -- controlled_document home lands HERE by design — Wave B documents can
      -- never carry an enforcing label, which is precisely why ethics letters
      -- home on the CASE resource instead (ADR 0114 Amendment 2).
      return false;
    end if;
    return app.confidentiality_clearance_ok(v_case, v_conf, p_uid);
  end if;
  return true;
end;
$function$;

create or replace function app.can_write_document(p_document_id uuid, p_uid uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id
    into v_resource, v_type, v_commission
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;
  case v_type
    when 'case' then
      if app.is_case_excluded(v_resource, p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'action_item' then
      if app.is_case_excluded(app.case_of_action_item(v_resource), p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or exists (select 1 from public.action_items ai
                     where ai.id = v_resource and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = v_resource and a.user_id = p_uid
                       and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(v_resource, p_uid);
    -- DM3 Wave B: writing a controlled document's files mirrors the authority
    -- the retiring `set_document_version_file` enforced (app.is_staff_admin_of
    -- on the owning commission). The APPROVER arm is deliberately absent here —
    -- an approver reads the artifact he reviews; he does not replace its bytes.
    when 'controlled_document' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    else
      return false;
  end case;
end;
$function$;
