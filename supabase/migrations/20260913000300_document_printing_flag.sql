-- =============================================================================
-- PDF·P1 M4 — the document_printing feature flag (ADR 0104 D15).
--
-- Ships OFF, platform-wide. Kinds activate by registering a data provider in
-- src/lib/pdf-mint/ (no flag proliferation — one flag for the module).
-- seed.sql forces ON for local/E2E (house pattern), in the same commit as
-- this migration; `FeatureFlags` in src/lib/queries/feature-flags.ts gains
-- the key alongside.
--
-- Every door (mint / open / revoke / lookup) asserts this flag via
-- app.assert_document_printing_enabled() — flag OFF fails them all with the
-- house disabled-feature error class (check_violation).
-- =============================================================================

insert into app.feature_flags (key, enabled, description)
values (
  'document_printing',
  false,
  'PDF document printing (ADR 0104): record-semantics minting, QR verification, '
  'download overlay. Ships OFF platform-wide; local/E2E forced ON by seed.sql.'
)
on conflict (key) do nothing;
