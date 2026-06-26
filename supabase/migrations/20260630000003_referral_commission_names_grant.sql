-- Fix: grant column-level SELECT on the two commission-name columns added in
-- 20260630000001. case_referral does NOT have a table-level SELECT grant for
-- `authenticated` — 20260620016000_referrals_description_lockdown.sql REVOKED it and
-- replaced it with a COLUMN-level grant (omitting the PHI free-text description_md /
-- decline_note). Column-level grants do NOT extend to columns added later, so
-- source_commission_name / target_commission_name were ungranted, and selecting them
-- raised `42501 permission denied for table case_referral` on the list/card path.
--
-- These two columns are PHI-FREE governance metadata (committee display names),
-- identical in sensitivity to source_commission_id / target_commission_id which are
-- already granted — so add them to the column-level grant. The PHI free-text columns
-- stay locked (this does not touch them). service_role keeps its full table grant.

GRANT SELECT ("source_commission_name", "target_commission_name")
  ON TABLE "public"."case_referral" TO "authenticated";
