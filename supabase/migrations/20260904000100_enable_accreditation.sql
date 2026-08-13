-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration G:
-- the flag flip. ADR 0093. This is the migration whose ABSENCE makes a
-- phase go dark after `db push` (the FF-program lesson) — the whole reason
-- `accreditation` was seeded OFF (`20260903000800_accreditation_schema`)
-- and stayed OFF through every Wave 1/2 migration since. Phase 16 is
-- PO-APPROVED (Phase Gate step 4); this is step 5 (Record).

update app.feature_flags set enabled = true where key = 'accreditation';
