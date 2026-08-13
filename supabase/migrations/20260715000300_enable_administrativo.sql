-- -----------------------------------------------------------------------------
-- Administrativo delegated-capability role (ADR 0061): flip the `administrativo`
-- flag ON. The feature's ship state (mirror of the controlled_docs /
-- quality_indicators flips). Full lifecycle (appointment, curated capability
-- menu, guarded DEFINER doors) is complete and QA APPROVED (0 BLOCKER/MAJOR/MINOR;
-- pgTAP 50/50; feature E2E 10/10; full regression 574 pass, 0 regressions —
-- docs/reviews/administrativo-review.md). Seeded OFF-by-default in
-- …014000000; this is the deliberate go-live flip.
-- -----------------------------------------------------------------------------
update app.feature_flags set enabled = true where key = 'administrativo';
