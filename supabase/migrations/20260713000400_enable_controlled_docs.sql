-- -----------------------------------------------------------------------------
-- Phase 17 — Controlled-Document Lifecycle: flip the `controlled_docs` flag ON.
-- The Phase-17 ship state (mirror of the …012000300 quality_indicators flip).
-- Core tables + lifecycle RPCs + DEFINER reads + storage bucket + the
-- forms-as-controlled-docs publish metadata are all live now. Seeded OFF in
-- …013000000; enabled locally via seed.sql during the test gate; this is the
-- deliberate Record-step prod flip.
-- -----------------------------------------------------------------------------
update app.feature_flags set enabled = true where key = 'controlled_docs';
