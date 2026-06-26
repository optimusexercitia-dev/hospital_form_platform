-- ----------------------------------------------------------------------------
-- Revoke PUBLIC/anon EXECUTE on snap_referral_commission_names() (security guard)
-- ----------------------------------------------------------------------------
-- 20260630000001_referral_commission_names.sql created the SECURITY DEFINER
-- trigger function public.snap_referral_commission_names() but, unlike every
-- other public function in this codebase, never revoked the default PUBLIC
-- EXECUTE grant. That tripped the generic anon-leak guard (100_dashboard.sql
-- test 19: "no public function is anon-executable"). Practical exposure is nil
-- (a trigger function fires as the table owner and anon cannot mutate
-- public.case_referral under RLS), but the guard is the convention and this
-- closes the leak. Forward-only / additive; nothing else changes.
-- ----------------------------------------------------------------------------

set search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.snap_referral_commission_names() FROM PUBLIC;
