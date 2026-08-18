-- FUP-DM5-DVF-FILEOBJ — make the 1:1 binding between a document version file and
-- its stored bytes STRUCTURAL rather than a property of caller discipline.
-- Ruled 2026-08-18 (DM-FUP TRIAGE #4); binding input to ADR 0121's disposal lifecycle.
--
-- STATE BEFORE THIS MIGRATION (measured from the live catalog, not from file text):
--   `document_version_files` carried exactly one unique constraint —
--   `document_version_files_version_rendition_uniq (document_version_id, rendition_kind)`
--   and NOTHING on `file_object_id`. All three writers
--   (`complete_document_reclassification`, `complete_document_upload_verification`,
--   `mint_printed_document`) insert a `file_object` they minted in the SAME call, so
--   1:1 held in practice and by nothing else.
--
-- WHY STRUCTURAL, AND NOT A pgTAP PIN:
--   Disposal operates on `file_objects`. If two `document_version_files` rows ever
--   shared one `file_object`, marking one row `disposal_pending` would silently
--   destroy the OTHER row's bytes, and no arm would notice — the failure is invisible
--   in the reassuring direction. A suite that pins today's behaviour does not remove
--   the dependency on discipline; a constraint does.
--
-- WHAT THIS KNOWINGLY FORECLOSES:
--   Byte-sharing between renditions of one version (e.g. a PDF whose `source` and
--   `preview` are the same object). That option is given up deliberately — the
--   disposal-safety argument was judged worth the price. Reversing it means
--   dropping this constraint AND giving disposal a reference count first.
--
-- ⛔ PUSH SAFETY — READ BEFORE `db push`:
--   The local DB had 0 `document_version_files` rows and 0 duplicates when this was
--   written, so a green local `supabase db reset` proves NOTHING about the remote.
--   Census the remote for duplicate `file_object_id` BEFORE pushing.
--   This is deliberately NOT guard-wrapped: if duplicates exist the push must FAIL
--   LOUDLY. A guard that skipped the constraint on conflicting data would leave the
--   invariant unenforced while reporting success, which is the very failure direction
--   this migration exists to close.

alter table public.document_version_files
  add constraint document_version_files_file_object_uniq
  unique (file_object_id);

comment on constraint document_version_files_file_object_uniq
  on public.document_version_files is
  'FUP-DM5-DVF-FILEOBJ / ADR 0121: one file_object backs at most ONE document version '
  'file. Disposal acts on file_objects, so a shared object would let one row''s '
  'disposal silently destroy another row''s bytes. Forecloses rendition byte-sharing '
  'by design — reversing it requires a reference count in the disposal path first.';
