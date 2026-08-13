-- =============================================================================
-- F2 (ADR 0063 / ADR 0065 §F2 item 9) — Centralized Attachments, migration 6 of 6:
--   seed the `attachments` feature flag OFF (Q10).
--
-- RLS is enabled on every new attachments table from creation regardless (Rule 1);
-- the flag gates only RPC/feature REACHABILITY (create_attachment / open_attachment /
-- reclassify_attachment / soft_delete_attachment / dispose_attachment_phi all call
-- app.assert_attachments_enabled() first), never the security boundary.
--
-- Ships OFF (pre-pilot). The gate enables it via seed.sql for E2E (F1 precedent); the
-- production flip ships WITH the feature and is deferred to the pilot cutover — no
-- separate `_enable` migration in F2.
-- =============================================================================

insert into app.feature_flags (key, enabled, description) values
  ('attachments', false,
   'When true, the centralized attachments layer (ADR 0063 F2) is reachable: the '
   'create_attachment / open_attachment (audited PHI door) / reclassify_attachment / '
   'soft_delete_attachment / dispose_attachment_phi RPCs and the two tiered buckets. '
   'Ships OFF (pre-pilot); enabled via seed.sql for E2E, production flip deferred to the '
   'pilot cutover.')
  on conflict (key) do update set enabled = excluded.enabled, description = excluded.description;
