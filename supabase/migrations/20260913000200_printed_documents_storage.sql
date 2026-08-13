-- =============================================================================
-- PDF·P1 M3 — the printed-documents bucket (ADR 0104 D8/D9.4; plan §2.1 M3,
-- lead-approved 2026-08-07).
--
-- ⛔ ZERO storage.objects policies for this bucket, DELIBERATELY — the
-- strictest live precedent (attachments-phi's read side), extended to writes:
--   - NO authenticated SELECT: D8 makes the serving route the ONLY byte path
--     (bare signed Storage URLs for printed_documents objects are a defect
--     class from day one — ADR 0104 Consequences). The route streams bytes
--     via service-role AFTER open_printed_document authorizes + audits, and
--     lays the SUBSTITUÍDO/ANULADO overlay on non-active documents.
--   - NO authenticated INSERT: the upload happens server-side in the mint
--     action (service-role), at the derived path the registry row will pin
--     (std/<id>.pdf; phi/<id>.pdf from P3 — two dumb prefixes, D9.4).
--
-- Rule 6 immutability: a new mint = a NEW path, enforced structurally by
-- pd_storage_path_derived (the path is the registry id); nothing updates an
-- object in place. Minted PDFs are never deleted (D15 — 20-yr posture); the
-- only object delete is the mint action's own all-or-nothing cleanup of an
-- object whose registry insert failed (D5).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'printed-documents',
  'printed-documents',
  false,
  26214400,               -- 25 MB, the house document cap
  array['application/pdf']::text[]
)
on conflict (id) do nothing;
