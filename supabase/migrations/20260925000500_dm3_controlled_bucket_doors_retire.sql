-- =============================================================================
-- DM3 · M5 — the `controlled-documents` bucket loses BOTH doors; byte serving
-- moves to the audited `open_document_version` corridor.
--
-- ADR 0114 D8; plan §3 M5; lead ruling Q4.
--
-- ⚠ SCOPE WIDENING, RECORDED. DM3 step 4 names only the SELECT policy. The
-- catalog shows TWO live doors, and the INSERT one
-- (`controlled_documents_obj_insert_writable`, WITH CHECK
-- `app.is_staff_admin_of(foldername[1])`) bypasses `begin_document_upload`
-- ENTIRELY — no reserved-path check, no server-derived tier, no `file_objects`
-- row, no `upload_sessions` row. M4 removed its only legitimate caller, so
-- keeping it would leave a hole straight through the command layer DM2 built,
-- in the very phase that deletes the feature it served. The plan text was
-- incomplete, not exceeded (lead-ruled Q4 2026-08-13).
--
-- The bucket ROW itself is NOT deleted here: DM5 owns bucket deletion under a
-- single retirement manifest ("do not delete any early"). The 3 PROVISIONAL,
-- un-re-measured production objects in it are quarantined, never migrated —
-- no version row references them, so there is nothing to bind them to.
--
-- Drop set derived from the CATALOG, not from a name list: `pg_policies` for
-- the doors, and a `prosrc` + `pg_depend` sweep for the predicate (its only
-- reference is the SELECT policy dropped immediately above it — verified).
-- =============================================================================

drop policy controlled_documents_obj_select_member on storage.objects;
drop policy controlled_documents_obj_insert_writable on storage.objects;

drop function app.can_read_document_object(text, uuid);

-- --- ACL hygiene on the Phase-17 helpers DM3 leaves live ----------------------
-- ADR 0114 D7 requires every DEFINER door PUBLIC-revoked. The DM1/DM2 core doors
-- comply; these Phase-17 DEFINER helpers predate the rule and still carry the
-- Postgres default (PUBLIC EXECUTE). Not a live leak — `anon` holds no USAGE on
-- schema `app` and config.toml exposes only `public` to PostgREST — but they are
-- inside DM3's diff and two of them are now load-bearing for the kernel arm
-- (`app.is_document_approver_of` is called by `app.can_read_document`).
-- The remaining PUBLIC-EXECUTE `app.*` trigger functions are named in the plan
-- §1.8 residual list rather than swept up silently here.
revoke execute on function app.is_document_approver_of(uuid, uuid) from public;
grant  execute on function app.is_document_approver_of(uuid, uuid) to authenticated, service_role;

revoke execute on function app.is_document_version_approver(uuid, uuid) from public;
grant  execute on function app.is_document_version_approver(uuid, uuid) to authenticated, service_role;

revoke execute on function app.can_read_document_of_version(uuid, uuid) from public;
grant  execute on function app.can_read_document_of_version(uuid, uuid) to authenticated, service_role;

revoke execute on function app.commission_of_document(uuid) from public;
grant  execute on function app.commission_of_document(uuid) to authenticated, service_role;

revoke execute on function app.commission_of_document_version(uuid) from public;
grant  execute on function app.commission_of_document_version(uuid) to authenticated, service_role;

revoke execute on function app.decide_document_approval_core(uuid, text, text) from public;
grant  execute on function app.decide_document_approval_core(uuid, text, text) to authenticated, service_role;
