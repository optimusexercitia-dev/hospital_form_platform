-- AUD1 — an `org_admin` reads the HOSPITAL-TIER audit rows of its own organization.
-- ADR 0146 (amends ADR 0051).
--
-- THE DEFECT. `audit_log_select`'s org leg carried three conjuncts:
--   (hospital_id IS NULL) AND (commission_id IS NULL) AND app.is_org_admin_of(organization_id)
-- A HOSPITAL-TIER row (`hospital_id` set, `commission_id` NULL) fell through EVERY leg for
-- an org_admin: leg 3 requires `app.is_hospital_admin_of`, which an org_admin is not, and
-- leg 4 excluded the row on `hospital_id IS NULL`. Commission-tier rows survive through
-- leg 2 (`app.is_tenancy_admin_of`), which is precisely why `/o/[org]/manage/audit` looked
-- populated while never once showing an org admin a hospital-scope event.
--
-- Measured before this migration (`orgadmin.a`, harness asserted `is_org_admin_of = t`,
-- `is_admin() = f`), scoping BOTH sides to org A so the comparison is honest:
--   commission tier  173 exist / 173 visible
--   hospital   tier   19 exist /   0 visible   ← TOTAL blindness, not a partial gap
--   org        tier   16 exist /  16 visible
-- The hidden rows were `membership.granted` (15) and `affiliation.created` (4).
--
-- ⭐ THIS IS A RECONCILIATION, NOT A WIDENING OF INTENT. `public.verify_audit_chain` is
-- SECURITY DEFINER and its hospital arm already reads:
--     app.is_hospital_admin_of(p_hospital)
--     OR app.is_org_admin_of((select organization_id from public.hospitals where id = p_hospital))
-- Probed before the migration: an org_admin calling `verify_audit_chain(p_hospital := …)`
-- SUCCEEDS (`ok = t`) while `select … from audit_log` over those same rows returns ZERO.
-- An org admin could cryptographically attest that a hospital's audit chain was intact and
-- not see one entry in it. The DEFINER door and the RLS policy encoded contradictory rules
-- and the DOOR held the intended one; this migration brings RLS into line with it.
-- (`prosecdef` belongs beside `pg_policies` — ADR 0078 methodology finding, ADR 0079.)
--
-- THE CHANGE. Exactly one conjunct — `(hospital_id IS NULL)` — is removed from leg 4.
-- Nothing else moves. The USING expression was re-emitted from the LIVE `pg_policies.qual`
-- rather than copied from an older migration file, because migration text in this repo is
-- stale by design.
--
-- ⛔ LEG 5 IS DELIBERATELY NOT TOUCHED, AND THE SYMMETRY IS A TRAP. Leg 5 reads
-- `(organization_id IS NULL) AND (commission_id IS NULL) AND app.is_admin()`. It has the
-- same SHAPE as the defect just fixed — a null-scope conjunct narrowing an admin's reach —
-- and removing it would look like finishing the job. It is not the same thing: that bound
-- is the platform-admin NOUN RULE (CLAUDE.md §1, ADR 0078 A35). A `platform_admin`
-- administers tenancy, identity, vocabulary and audit *infrastructure*; it must never read
-- tenant CONTENT. Widening leg 5 would hand every platform admin every tenant's audit
-- trail. Leg 4's null-conjunct was wrong because an org_admin IS the administrator of the
-- hospitals in its org; leg 5's is right because a platform_admin is NOT the administrator
-- of a tenant's records. Test 369 §5.2 and §6.5 both fail if this leg moves.

alter policy audit_log_select on public.audit_log
using (
  app.is_staff_admin_of(commission_id)
  or app.is_tenancy_admin_of(commission_id)
  or ((commission_id is null) and app.is_hospital_admin_of(hospital_id))
  -- AUD1: the ONLY edit — `(hospital_id IS NULL) and` removed. An org_admin administers
  -- every hospital in its org, so hospital-tier rows of that org are its rows to read.
  or ((commission_id is null) and app.is_org_admin_of(organization_id))
  -- ⛔ UNCHANGED ON PURPOSE — the noun rule. See the header before touching this.
  or ((organization_id is null) and (commission_id is null) and app.is_admin())
);

-- ---------------------------------------------------------------------------
-- Post-condition guard. The predicate above is a LITERAL, so drift between what was live
-- when it was read and what is live when it applies would be silently overwritten rather
-- than reported. Re-read the catalog and raise unless the intended shape landed: the
-- narrowing conjunct gone, leg 5's bound still present, and all five role checks intact
-- (a rewrite that dropped a role check would make the behavioural tests pass for the
-- wrong reason).
-- ---------------------------------------------------------------------------
do $$
declare
  v_qual text;
begin
  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'audit_log' and policyname = 'audit_log_select';

  if v_qual is null then
    raise exception 'AUD1: audit_log_select is missing after the rewrite';
  end if;
  if v_qual like '%hospital_id IS NULL%' then
    raise exception 'AUD1: the (hospital_id IS NULL) conjunct survived the rewrite';
  end if;
  if v_qual not like '%(organization_id IS NULL)%' then
    raise exception 'AUD1: leg 5 lost its (organization_id IS NULL) bound — the platform-admin noun rule (ADR 0078 A35) must NOT be widened';
  end if;
  if v_qual not like '%is_staff_admin_of%'
     or v_qual not like '%is_tenancy_admin_of%'
     or v_qual not like '%is_hospital_admin_of%'
     or v_qual not like '%is_org_admin_of%'
     or v_qual not like '%is_admin()%' then
    raise exception 'AUD1: a role check was lost in the re-emission';
  end if;

  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'audit_log') <> 1 then
    raise exception 'AUD1: audit_log must carry exactly one policy';
  end if;
end $$;

comment on policy audit_log_select on public.audit_log is
  'AUD1/ADR 0146: the org leg admits HOSPITAL-TIER rows (commission_id IS NULL AND is_org_admin_of(organization_id)) — an org_admin administers every hospital in its org, and verify_audit_chain already granted it the same reach. Leg 5 keeps its (organization_id IS NULL) bound deliberately: that is the platform-admin noun rule (ADR 0078 A35), NOT the same defect.';
