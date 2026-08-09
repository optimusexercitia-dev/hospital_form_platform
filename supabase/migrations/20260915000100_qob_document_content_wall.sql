-- QO·B M2 — org_admin / hospital_admin content wall: controlled documents + printed documents.
--
-- ADR 0100 D12; classification PO-ratified 2026-08-08. Companion to M1 (response plane).
--
-- ⚠ THE A4 K2 LESSON APPLIES HERE, which is why this migration edits FUNCTIONS and not
--    only policies. Three policies in this wave do not carry the tenancy arm themselves —
--    they route a wrapper that does:
--        document_approvals_select                -> app.can_read_document_of_version
--        controlled_documents_obj_select_member   -> app.can_read_document_object
--        printed_documents_select                 -> app.can_view_printed_document
--    Narrowing the policies alone would have been a NO-OP. Narrowing the wrappers is what
--    actually moves the boundary, and it propagates to every consumer automatically.
--
-- Functions are re-emitted with CREATE OR REPLACE (never DROP + CREATE): a rebuild
-- silently drops the ACL, and these carry EXECUTE grants the policies depend on.
--
-- MEASURED PRE-IMAGE: controlled_documents org_admin 3 / hospital_admin 3 / staff_admin 2;
-- controlled_document_versions 3/3/2; document_approvals 4/4/4; printed_documents 6/6/6.

begin;

-- ---------------------------------------------------------------------------
-- Wrapper 1 — version-scoped document read. Consumed by document_approvals_select.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_document_of_version(p_version_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- QO·B (ADR 0100 D12): the app.is_commission_admin_of_for arm is deliberately ABSENT.
  -- Committee membership and the approver corridor remain; the tenancy admin does not
  -- read document content.
  select
    app.is_member_of_for(app.commission_of_document_version(p_version_id), p_uid);
$function$;

-- ---------------------------------------------------------------------------
-- Wrapper 2 — storage-object document read. Consumed by controlled_documents_obj_select_member.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_document_object(p_name text, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- QO·B (ADR 0100 D12): tenancy-admin arm removed. The approver arm is retained — an
  -- approver is a functional role on the document itself, not a tenancy noun.
  select
    app.is_member_of_for((storage.foldername(p_name))[1]::uuid, p_uid)
    or exists (
      select 1
      from public.document_approvals a
      join public.controlled_document_versions v on v.id = a.document_version_id
      where v.document_id = (storage.foldername(p_name))[2]::uuid
        and a.approver_id = p_uid
    );
$function$;

-- ---------------------------------------------------------------------------
-- Wrapper 3 — printed-document sight. Consumed by printed_documents_select and by the
-- mint/open doors.
--
-- ⚠ ITS OWN COMMENT WENT STALE THE MOMENT M1 LANDED: the form_response arm documented
--    itself as mirroring "responses_select … responses_admin_all: commission-admin chain
--    (already covered)". M1 DELETED responses_admin_all and removed the commission-admin
--    term from responses_select. Left alone, this wrapper would have kept granting the
--    tenancy admin sight of printed responses that the underlying table no longer shows
--    them — the mirror must move with the mirrored. Comment and code updated together.
-- ---------------------------------------------------------------------------
create or replace function app.can_view_printed_document(p_source_kind text, p_source_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
      -- over-reach breaks legitimate surface). As of QO·B M1 those are:
      --   responses_select:          own row OR (submitted AND staff_admin)
      --                              OR correction-corridor
      --   responses_select_targeted: targeted-respondent corridor
      --   responses_admin_all:       DELETED by M1 (was the tenancy-admin FOR ALL grant)
      -- No app.is_commission_admin_of_for arm: ADR 0100 D12.
      return v_resp.created_by = p_uid
          or (v_resp.status = 'submitted'
              and app.is_staff_admin_of_for(v_resp.commission_id, p_uid))
          or app.can_read_correction_response(p_source_id, p_uid)
          or app.can_access_targeted_response(p_source_id, p_uid);
    when 'meeting' then
      -- A7 FULL-SIGHT CONJUNCTION: reach (member AND (commission_default OR
      -- attendee); NO admin arm — C7) AND unmasked full-content sight. Unchanged
      -- by QO·B: this arm never carried a tenancy-admin term.
      return app.can_reach_meeting(p_source_id, p_uid)
         and app.can_read_full_meeting_content(p_source_id, p_uid);
    else
      -- case | interview arms land in P3..P4 (one per phase).
      -- ELSE_FAIL_CLOSED: an unhandled kind is UNREADABLE, not exposed
      -- (ADR 0104 D3) — a new printable kind that forgets its arm fails shut.
      return false;
  end case;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Policies that carry the arm directly.
-- ---------------------------------------------------------------------------
drop policy if exists controlled_documents_select on public.controlled_documents;
create policy controlled_documents_select on public.controlled_documents
  as permissive for select to authenticated
  using (
    app.is_member_of(commission_id)
    or app.is_document_approver_of(id, auth.uid())
  );

comment on policy controlled_documents_select on public.controlled_documents is
  'QO·B (ADR 0100 D12): tenancy-admin arm app.is_commission_admin_of deliberately ABSENT — '
  'org_admin/hospital_admin do not read controlled-document content.';

drop policy if exists controlled_document_versions_select on public.controlled_document_versions;
create policy controlled_document_versions_select on public.controlled_document_versions
  as permissive for select to authenticated
  using (
    app.is_member_of(app.commission_of_document(document_id))
    or app.is_document_version_approver(id, auth.uid())
  );

-- Storage: writing a controlled-document object is committee work (staff_admin), not a
-- tenancy-admin duty. The is_staff_admin_of arm is retained verbatim.
drop policy if exists controlled_documents_obj_insert_writable on storage.objects;
create policy controlled_documents_obj_insert_writable on storage.objects
  as permissive for insert to authenticated
  with check (
    bucket_id = 'controlled-documents'
    and app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Postconditions — derived, not hardcoded, each with a non-vacuity twin.
-- ---------------------------------------------------------------------------
do $$
declare v_bad text; v_pop int;
begin
  -- (a) No policy on the document plane may carry a tenancy-admin arm.
  select string_agg(tablename||'.'||policyname, ', '), count(*) filter (where true)
    into v_bad, v_pop
  from pg_policies
  where schemaname in ('public','storage')
    and ( tablename in ('controlled_documents','controlled_document_versions','document_approvals','printed_documents')
          or policyname like 'controlled_documents_obj%' )
    and coalesce(qual,'')||' '||coalesce(with_check,'') ~ '\yis_commission_admin_of\y';
  if v_bad is not null then
    raise exception 'QO·B M2 postcondition (a): tenancy-admin arm still on: %', v_bad;
  end if;

  -- (b) …and neither may the three wrappers those policies route. This is the half a
  --     policy-only check cannot see (the A4 K2 no-op).
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace = 'app'::regnamespace
    and p.proname in ('can_read_document_of_version','can_read_document_object','can_view_printed_document')
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ '\yis_commission_admin_of(_for)?\y';
  if v_bad is not null then
    raise exception 'QO·B M2 postcondition (b): wrapper still routes the tenancy admin: %', v_bad;
  end if;

  -- (c) Non-vacuity: all three wrappers must actually exist, or (b) passes trivially.
  select count(*) into v_pop from pg_proc
   where pronamespace='app'::regnamespace
     and proname in ('can_read_document_of_version','can_read_document_object','can_view_printed_document');
  if v_pop <> 3 then
    raise exception 'QO·B M2 postcondition (c) VACUOUS: expected 3 wrappers, found %', v_pop;
  end if;
end $$;

commit;
