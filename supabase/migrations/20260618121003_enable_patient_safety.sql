-- Phase 14a / B4 tail: enable the patient_safety feature flag.
--
-- Mirror of 20260615091004 (interviews) / 20260615090008 (meetings) / the cases
-- flag flips: a separate one-line migration flips `patient_safety` ON at sub-phase
-- completion. Enabled IN-PHASE so the gate (E2E + pgTAP) exercises the live feature.
-- Every Phase-14 RPC gates app.assert_patient_safety_enabled() and the server
-- actions gate public.patient_safety_enabled(); both now pass. This single umbrella
-- flag covers 14a–14d (ADR 0030).
update app.feature_flags set enabled = true where key = 'patient_safety';
