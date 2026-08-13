-- =============================================================================
-- QO·A M9 — the resolve door carries the M8 bytes cut
-- (found by `frontend` post-M8, live-probed by `backend` 2026-08-06).
--
-- M8 cut the reviewer out of `storage.objects` — but the storage policy is not
-- the whole bytes layer. `public.open_attachment` (SECURITY DEFINER,
-- authenticated EXECUTE) resolves an attachment's bucket+path, and its app
-- action then signs that path with the SERVICE ROLE (`src/lib/attachments/
-- actions.ts`) — storage RLS never runs on that mint. Its in-body gate keyed on
-- `can_read_attachment` = content, which S7 confers, so a reviewer calling the
-- door resolved a signable path (probed live: 1 row) and the server action is
-- reachable outside the UI. "Reads 0 object rows" says nothing about what a
-- DEFINER hands out — the BUG-AUTHZ-001 shape, on the door beside the policy.
--
-- Sibling set CLOSED from the catalog: exactly three functions touch
-- storage_bucket+storage_path — guard_attachment_immutable (trigger),
-- create_attachment (write door; can_write_attachment already excludes the
-- read-only reviewer — D7), and this one. The list path
-- (`src/lib/queries/attachments.ts`) mints under the USER's JWT and is already
-- M8-governed.
--
-- The cut is the SAME conjunct as M8, in-body: case/interview owners require
-- `read_case_deliberation` — conferred by every content source EXCEPT the S7
-- oversight arm (D4; the invariant M8's header states). Same silent-return deny
-- as the door's other reach gates; the HC0E6 confidentiality ceiling and the
-- PHI-tier audited open below it are untouched. Body re-emitted from the LIVE
-- pg_get_functiondef (2026-08-06); CREATE OR REPLACE preserves the ACL.
-- Keystones: 308 §5.5–5.7 (5.5 observed RED pre-M9); mutation:
-- q1 `open_resolver_door`.
-- =============================================================================

create or replace function public.open_attachment(p_id uuid)
 returns table(bucket text, path text)
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.attachments;
begin
  perform app.assert_attachments_enabled();

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    return;                                          -- not found
  end if;
  if v_row.deleted_at is not null then
    return;                                          -- soft-deleted: gone
  end if;
  if v_row.scan_status = 'infected' then
    return;                                          -- never serve an infected object
  end if;
  if not app.can_read_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
    return;                                          -- NULL-out-of-scope: no row, no audit
  end if;
  -- QO·A M9 (the M8 bytes cut, at the door): this DEFINER's result is signed by
  -- the SERVICE ROLE downstream, so the storage policy never governs it.
  -- Case/interview bytes require read_case_deliberation — every content source
  -- except the S7 oversight arm confers it (ADR 0100 D4/D5/D7). Reopening for
  -- the reviewer is Phase B+ WITH an audit emit, never a deleted conjunct.
  if v_row.owner_type in ('case', 'interview')
     and not app.has_case_capability(
           case v_row.owner_type
             when 'case' then v_row.owner_id
             else app.case_of_interview(v_row.owner_id)
           end,
           auth.uid(), 'read_case_deliberation') then
    return;                                          -- oversight-only reach: no path, no URL
  end if;
  -- ⟵E1 confidentiality ceiling: a known-id open of a gated document without clearance
  -- is a distinct, explicit denial (HC0E6) — contrast the list, which simply hides it.
  if not app.attachment_confidentiality_ok(
       v_row.owner_type, v_row.owner_id, v_row.confidentiality_label, auth.uid()) then
    raise exception 'sem autorização para abrir este documento confidencial'
      using errcode = 'HC0E6';
  end if;

  if v_row.sensitivity_tier = 'phi' then
    -- the single audited PHI open (Rule 11/12) — records THAT + WHO, never the blob.
    perform public.log_audit_access(
      'attachment.read', 'attachment', p_id,
      app.commission_of_attachment(v_row.owner_type, v_row.owner_id),
      'Anexo (PHI) aberto', '{}'::jsonb);
  end if;

  return query select v_row.storage_bucket, v_row.storage_path;
end;
$function$;

-- Postcondition: the cut is in the door AND still in the policy (both halves of
-- the bytes layer), and the door kept its DEFINER + ACL surface.
do $$
begin
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'open_attachment') !~ 'read_case_deliberation' then
    raise exception 'M9 postcondition: the door cut did not land';
  end if;
  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'attachments_obj_select_readable'
        and qual ~ 'read_case_deliberation') <> 1 then
    raise exception 'M9 postcondition: the M8 policy half went missing';
  end if;
  if not (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'open_attachment') then
    raise exception 'M9 postcondition: open_attachment lost SECURITY DEFINER';
  end if;
end $$;
