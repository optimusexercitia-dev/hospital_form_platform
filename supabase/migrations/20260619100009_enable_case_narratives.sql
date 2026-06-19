-- Case Narratives: enable the feature flag. ADR 0032.
--
-- Mirror of 20260615091004 (interviews) / the cases + meetings flag flips: a
-- separate one-line migration flips `case_narratives` ON at completion. Enabled
-- IN-PHASE so the gate (E2E + pgTAP) exercises the live feature, exactly as the
-- earlier feature flips did. Every Case-Narratives RPC gates
-- app.assert_narratives_enabled() and the server actions gate
-- public.case_narratives_enabled(); both now pass.
update app.feature_flags set enabled = true where key = 'case_narratives';
