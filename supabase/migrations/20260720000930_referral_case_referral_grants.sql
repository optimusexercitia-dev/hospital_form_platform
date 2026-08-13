-- =============================================================================
-- Referrals v2 (RV2) · R1 fix — case_referral column-grant gap for the new cols.
-- =============================================================================
-- `case_referral` protects PHI via COLUMN-LEVEL SELECT grants: authenticated has NO
-- table-level SELECT, only per-column `GRANT SELECT(col)` for the PHI-free columns
-- (description_md/decline_note omitted). R1 migration 20260720000900 ADDED
-- `last_message_at` + `waiting_on_committee_id` but did not extend that grant set —
-- so any authenticated direct SELECT that includes a new column (the referrals hub,
-- `listCommissionReferrals`) fails with 42501. `get_referral_detail` was unaffected
-- (DEFINER door bypasses column grants), which is why pgTAP missed it.
--
-- Both new columns are PHI-FREE metadata (waiting-on committee id; last-activity
-- timestamp), so authenticated SELECT is correct. service_role already holds
-- `GRANT ALL ON TABLE case_referral` (table-level → covers future columns), so only
-- authenticated needs the per-column grant. Memory: case-referral-column-grants.
-- =============================================================================

grant select (waiting_on_committee_id) on table public.case_referral to authenticated;
grant select (last_message_at) on table public.case_referral to authenticated;
