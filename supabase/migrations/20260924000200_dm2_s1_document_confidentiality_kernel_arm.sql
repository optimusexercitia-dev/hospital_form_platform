-- =============================================================================
-- DM2·S1 — the D15 confidentiality ceiling, part 2 of 2: the read-side arm in
-- the app.can_read_document kernel (ADR 0114 Amendment 1 D15; ADR 0072 D7
-- semantics). Body derived from the LIVE pg_get_functiondef (2026-08-13,
-- 368-migration catalog) plus exactly one addition — the ceiling conjunct.
-- Migration text is stale by design; the DO blocks below refuse to apply over
-- a drifted catalog and verify the result, so the asserts, not this file, are
-- the guarantee.
--
-- The arm is an AND-conjunct AFTER the home-resource dispatch (the retired
-- mechanism's order: owner-auth first, then the label — ADR 0072 as-built
-- delta 2). A conjunction can only narrow (authz-handoff §7.7).
-- =============================================================================

do $$
declare
  v_src text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_document';
  if v_src is null then
    raise exception 'S1 part 2: app.can_read_document not found — catalog drifted';
  end if;
  if v_src ~ 'confidentiality' then
    raise exception 'S1 part 2: the kernel already carries a confidentiality arm — re-derive from the catalog';
  end if;
  if v_src !~ 'can_read_case_committee\(app\.case_of_interview'
     or v_src !~ 'is_member_of_for' or v_src !~ 'can_read_action_item' then
    raise exception 'S1 part 2: kernel dispatch shape drifted from the derivation base — re-derive from pg_get_functiondef';
  end if;
end $$;

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
    when 'interview' then app.can_read_case_committee(app.case_of_interview(v_resource), p_uid)
    when 'action_item' then app.can_read_action_item(v_resource, p_uid)
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
      -- Phase-19 access plane (D16) absorbs the column.
      return false;
    end if;
    return app.confidentiality_clearance_ok(v_case, v_conf, p_uid);
  end if;
  return true;
end;
$function$;

do $$
declare
  v_src text;
  v_acl text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), p.proacl::text
    into v_src, v_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_document' and p.prosecdef;
  if v_src is null then
    raise exception 'S1 part 2 postcondition: kernel missing or lost SECURITY DEFINER';
  end if;
  if v_src !~ 'confidentiality_clearance_ok' then
    raise exception 'S1 part 2 postcondition: the ceiling arm did not land';
  end if;
  if v_acl !~ 'authenticated=X' or v_acl !~ 'service_role=X' then
    raise exception 'S1 part 2 postcondition: the kernel ACL changed (expected authenticated+service_role EXECUTE): %', v_acl;
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'can_read_document'
       and p.proconfig::text ~ 'search_path=app, public, pg_catalog') then
    raise exception 'S1 part 2 postcondition: pinned search_path lost';
  end if;
end $$;
