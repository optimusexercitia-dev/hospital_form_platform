-- Snapshot commission names onto case_referral so every reader (source member,
-- target member, QPS) can see which committee a referral was sent to/from,
-- without needing SELECT on the other commission's row.
--
-- Root cause: the commissions SELECT policy is scoped to member-or-org-admin-or-pqs-or-
-- nsp-coord; a source-commission staff member cannot SELECT the target commission's row,
-- so PostgREST's foreign-key embed `target_commission:target_commission_id(name)` returned
-- null. The case-detail outbound-referrals card fell back to the literal "comissão"
-- instead of showing the actual committee name.
--
-- Fix: add source_commission_name / target_commission_name TEXT columns, populated
-- by a SECURITY DEFINER trigger on INSERT/UPDATE of the commission id columns,
-- and backfill existing rows. The list query reads these columns directly — no join.

-- 1. Add the denormalized columns.
ALTER TABLE public.case_referral
  ADD COLUMN IF NOT EXISTS source_commission_name TEXT,
  ADD COLUMN IF NOT EXISTS target_commission_name TEXT;

-- 2. Backfill existing rows (runs as superuser in migration context; RLS bypassed).
UPDATE public.case_referral cr
SET
  source_commission_name = src.name,
  target_commission_name = tgt.name
FROM public.commissions src, public.commissions tgt
WHERE src.id = cr.source_commission_id
  AND tgt.id = cr.target_commission_id;

-- 3. Trigger function — SECURITY DEFINER so it can always read commission names
--    regardless of the calling user's commission membership. This matters for the
--    direct INSERT path (case_referral_insert_source_coord policy), where the
--    invoking user is NOT a member of the target commission.
CREATE OR REPLACE FUNCTION public.snap_referral_commission_names()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  SELECT name INTO NEW.source_commission_name
    FROM public.commissions WHERE id = NEW.source_commission_id;
  SELECT name INTO NEW.target_commission_name
    FROM public.commissions WHERE id = NEW.target_commission_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.snap_referral_commission_names() OWNER TO postgres;

-- 4. Attach to case_referral. Fires BEFORE INSERT and BEFORE UPDATE of either
--    commission-id column (commission reassignment is not a normal flow, but
--    keeping the columns in sync is cheap and correct).
DROP TRIGGER IF EXISTS referral_snap_commission_names ON public.case_referral;
CREATE TRIGGER referral_snap_commission_names
  BEFORE INSERT OR UPDATE OF source_commission_id, target_commission_id
  ON public.case_referral
  FOR EACH ROW
  EXECUTE FUNCTION public.snap_referral_commission_names();
