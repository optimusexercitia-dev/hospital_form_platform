-- Phase 11 / B2: enable the interviews feature flag.
--
-- Mirror of 20260615090008 (meetings) / the cases flag flips: a separate one-line
-- migration flips `interviews` ON at phase completion. Enabled IN-PHASE so the
-- gate (E2E + pgTAP) exercises the live feature, exactly as the meetings and
-- cases_multi_phase flips did. Every Phase-11 RPC gates app.assert_interviews_enabled()
-- and the server actions gate public.interviews_enabled(); both now pass.
update app.feature_flags set enabled = true where key = 'interviews';
