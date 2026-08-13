-- Stage-C defect fix: public.get_reserved_session_items(uuid) is an audited PHI-read
-- door — line 12 does PERFORM public.log_audit_access('meeting.viewed', ...) →
-- app.audit_write(...) → INSERT into public.audit_log (the unconditional Rule-11 PHI-read
-- audit). But the function is marked STABLE, and PostgREST executes STABLE/IMMUTABLE
-- functions inside a READ-ONLY transaction even over rpc/POST, so the audit INSERT raises
-- SQLSTATE 25006 ("cannot execute INSERT in a read-only transaction"). The FE browser
-- verification hit exactly this.
--
-- The established pattern for audited PHI-read doors is VOLATILE (get_case_patients,
-- get_participant_patient, get_referral_patient are all VOLATILE + audit). C5's RPC
-- deviated. Fix surgically with ALTER (NOT create-or-replace) so the C5 tier body is
-- untouched — zero re-emit drift. Blast radius = exactly 1 (lead-swept: the only STABLE
-- DEFINER fn that actually calls log_audit_access/audit_write).

alter function public.get_reserved_session_items(uuid) volatile;
