-- ADR 0078 D7 / F1: route every referral read consumer onto the correct split predicate
-- so the split is REAL, not cosmetic. Non-PHI envelope surfaces ride
-- `can_read_referral_metadata`; PHI surfaces ride `can_read_referral_phi` (now a clean
-- READ-only predicate, its write coupling removed in 20260811000100).
--
-- Routing decisions (full table in the F1 handoff):
--   * case_referral row (PHI columns description_md/decline_note/phi_disposed_reason are
--     already column-REVOKED from authenticated SELECT — the row is envelope-only) →
--     METADATA.
--   * referral_reply_attachment row (title + storage_path metadata; the OBJECT download
--     is separately PHI-gated by the storage policy below) → METADATA.
--   * RPC callers of can_read_referral (get_referral_detail's outer gate) ride the
--     backward-compat alias, which delegates to _metadata — no re-emit of the large RPC.
--   * PHI row policies (referral_messages/reply/shared_item), the get_referral_* PHI
--     doors, post_referral_message's read gate, and can_read_snapshot_document stay on
--     can_read_referral_phi (correct: PHI bodies/paths) — unchanged.
--   * Storage: referral reply attachments are PHI-bearing (the target committee's
--     clinical reply documents). They REMAIN gated on can_read_referral_phi — which F1
--     turned into a clean read-only predicate — re-established here deliberately so a
--     metadata-only reader can never pull a PHI attachment.

-- Envelope row: repoint onto the canonical metadata predicate.
drop policy if exists case_referral_select_readable on public.case_referral;
create policy case_referral_select_readable on public.case_referral
  for select to authenticated
  using (app.can_read_referral_metadata(id, auth.uid()));

drop policy if exists referral_reply_attachment_select_readable on public.referral_reply_attachment;
create policy referral_reply_attachment_select_readable on public.referral_reply_attachment
  for select to authenticated
  using (app.can_read_referral_metadata(referral_id, auth.uid()));

-- Storage object: re-establish on the (now write-decoupled) PHI read predicate.
drop policy if exists referral_attachments_obj_select on storage.objects;
create policy referral_attachments_obj_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'referral-attachments'
    and app.can_read_referral_phi(((storage.foldername(name))[2])::uuid, auth.uid())
  );
