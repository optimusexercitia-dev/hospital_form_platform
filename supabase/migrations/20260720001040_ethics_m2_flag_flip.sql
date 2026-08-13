-- =============================================================================
-- ETH·E1 (ADR 0072 D10) — BE-8: release the m2 gate. Flip case_participants +
-- case_types ON, now that the m2-flip checklist (ADR 0072) is GREEN:
--   1. respondent-exclusion live in can_read_case + _patient (BE-4);
--   2. recusal enforced in RLS + DEFINER-only writes (BE-3/BE-4/BE-5);
--   3. explicit_grants_only wired from case_types → cases.visibility_policy (BE-2/BE-4);
--   4. confidentiality column + attachment ceiling (BE-2/BE-4);
--   5. real participant write authority; case_participants SELECT-only (BE-5);
--   6. pgTAP isolation negatives green on a fresh reset (228_ethics_e1.sql, 111);
--   7. THIS flip + the FeatureFlags interface update.
--
-- LOCAL-FIRST: this phase never `db push`es, so this flip lands only in local
-- environments now (via `db reset`), making the generalized-subject layer live for
-- E2E. Production stays OFF until the deliberate pilot reset that applies this
-- migration (ADR 0072 D10 — the intended flip moment). E1 does NOT own the `ethics`
-- flag (E2 owns it, S0 §F.4).
-- =============================================================================

update app.feature_flags set enabled = true
  where key in ('case_participants', 'case_types');
