-- =============================================================================
-- DM1 / M4 — the document authorization kernel + the eight SELECT policies
-- (ADR 0114 D6/D8; plan docs/plans/dm1-substrate-cutover-plan.md §3 step 4;
-- ADR 0116).
--
-- Document access = HOME-RESOURCE access, resolved live through the EXISTING
-- domain predicates (ADR 0114 D6). Nothing is reimplemented: the kernel
-- dispatches to app.can_read_case / is_member_of_for / can_read_case_committee
-- / can_read_action_item / can_write_interview / is_staff_admin_of_for /
-- is_case_excluded — the same predicate FAMILY the retired attachment
-- dispatchers used (not byte-exact: QA r1 found a commission-admin OR-arm
-- delta on the retired meeting/interview arms that this kernel deliberately
-- does not carry; verified immaterial — the staff_admin hat already reaches
-- those rows through the retained membership arms. ADR 0116 §12).
--
-- ⛔ NOUN RULE (ADR 0078 A35): app.can_read_document has NO is_admin arm —
-- documents are commission CONTENT. Pinned BEHAVIORALLY by pgTAP 328 K5
-- (platform@test.local reads 0), not by body inspection.
--
-- EXACTLY ONE policy per table, deliberately: a second permissive sibling
-- makes every deny-assertion unfalsifiable (authz-handoff §7.1-6). pgTAP 328
-- K4 pins the one-policy invariant.
--
-- New boolean DEFINER doors (census domain, ADR 0079 — swept diff-scoped and
-- verdict-registered in this phase): can_read_document, can_write_document,
-- can_read_document_version, can_read_file_object, can_read_document_hold,
-- storage_upload_reserved. None reads memberships raw (ARM=hat clean).
-- =============================================================================

create function app.can_read_document(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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
  return case v_type
    when 'case' then app.can_read_case(v_resource, p_uid)
    when 'meeting' then app.is_member_of_for(v_commission, p_uid)
    when 'interview' then app.can_read_case_committee(app.case_of_interview(v_resource), p_uid)
    when 'action_item' then app.can_read_action_item(v_resource, p_uid)
    else false
  end;
end;
$$;

create function app.can_write_document(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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
    else
      return false;
  end case;
end;
$$;

create function app.can_read_document_version(p_version_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_document uuid;
begin
  select document_id into v_document
  from public.document_versions where id = p_version_id;
  return v_document is not null and app.can_read_document(v_document, p_uid);
end;
$$;

create function app.can_read_file_object(p_file_object_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  -- CHAIN-ONLY, deliberately (QA MAJOR-1, ADR 0116 §11): a file object is
  -- readable ONLY through a readable bound document. An uploader-sees-own arm
  -- was removed at QA — it widened against the retired surface, sat OUTSIDE
  -- the kernel chain (so a future FUP-DM1-CEILING ceiling would not govern
  -- it), and had no consumer until DM2. Pinned by 328 K13; DM2 may add
  -- uploader visibility deliberately, keystoned, ceiling-aware.
  return exists (
    select 1
    from public.document_version_files dvf
    join public.document_versions dv on dv.id = dvf.document_version_id
    where dvf.file_object_id = p_file_object_id
      and app.can_read_document(dv.document_id, p_uid)
  );
end;
$$;

create function app.can_read_document_hold(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select s.commission_id into v_commission
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_commission is null then
    return false;
  end if;
  -- Hold existence is write-authority governance metadata: coordinators of
  -- the home commission + tenancy admins.
  return app.is_staff_admin_of_for(v_commission, p_uid)
      or app.is_tenancy_admin_of_for(v_commission, p_uid);
end;
$$;

create function app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_uid is null then
    return false;
  end if;
  return exists (
    select 1
    from public.upload_sessions us
    join public.file_objects fo on fo.id = us.file_object_id
    where us.reserved_by = p_uid
      and us.state = 'reserved'
      and us.expires_at > now()
      and fo.storage_bucket = p_bucket
      and fo.storage_path = p_name
      and fo.upload_state = 'reserved'
  );
end;
$$;

-- EXECUTE posture (house norm, verified against the sibling predicates'
-- ACLs): authenticated + service_role; never PUBLIC/anon.
revoke all on function app.can_read_document(uuid, uuid) from public, anon;
revoke all on function app.can_write_document(uuid, uuid) from public, anon;
revoke all on function app.can_read_document_version(uuid, uuid) from public, anon;
revoke all on function app.can_read_file_object(uuid, uuid) from public, anon;
revoke all on function app.can_read_document_hold(uuid, uuid) from public, anon;
revoke all on function app.storage_upload_reserved(text, text, uuid) from public, anon;
grant execute on function app.can_read_document(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_write_document(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_read_document_version(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_read_file_object(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_read_document_hold(uuid, uuid) to authenticated, service_role;
grant execute on function app.storage_upload_reserved(text, text, uuid) to authenticated, service_role;

-- The eight SELECT policies — exactly one per table (K4 pins this).
create policy documents_select on public.documents
  for select to authenticated
  using (app.can_read_document(id, (select auth.uid())));

create policy document_versions_select on public.document_versions
  for select to authenticated
  using (app.can_read_document(document_id, (select auth.uid())));

create policy document_version_files_select on public.document_version_files
  for select to authenticated
  using (app.can_read_document_version(document_version_id, (select auth.uid())));

create policy file_objects_select on public.file_objects
  for select to authenticated
  using (app.can_read_file_object(id, (select auth.uid())));

create policy document_placements_select on public.document_placements
  for select to authenticated
  using (app.can_read_document(document_id, (select auth.uid())));

create policy upload_sessions_select on public.upload_sessions
  for select to authenticated
  using (reserved_by = (select auth.uid()));

-- Retention config carries no tenant or clinical data (kind/tier/years).
create policy document_retention_select on public.document_retention
  for select to authenticated
  using (true);

create policy document_legal_holds_select on public.document_legal_holds
  for select to authenticated
  using (app.can_read_document_hold(document_id, (select auth.uid())));
