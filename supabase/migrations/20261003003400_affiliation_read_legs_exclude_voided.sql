-- AFF4 B3 — ADR 0151 D7 (amends ADR 0148): the ever-held person-read legs stop reading
-- VOIDED affiliations. This is the migration that closes Critical FUP C5,
-- `FUP-AFF3-NO-REVOCATION-FOR-A-MIS-ENTERED-AFFILIATION`.
--
-- THE DEFECT. ADR 0148 made person reads EVER-HELD: a hospital admin who once held an
-- affiliation over a person keeps reading that person's profile and council credentials
-- forever. That is correct for a real employment — the record of having worked together
-- does not expire — but it means a MIS-ENTERED affiliation grants a permanent,
-- unrevocable read, and `end_affiliation` cannot take it back: ending says "was true and
-- stopped", which is a lie about a row that was never true, and an ever-held leg reads
-- ended rows by construction. The third tense (D7) is what revokes.
--
-- ⚠ EXACTLY ONE CONJUNCT CHANGES, IN EXACTLY ONE LEG OF EACH OF THREE POLICIES, and all
-- three move together (the ADR 0148 discipline — a sibling left behind is a hole shaped
-- exactly like the one being closed). The affiliation leg gains `AND ha.voided_at IS
-- NULL`. Every other character of every predicate below is re-emitted BYTE-FOR-BYTE from
-- the live `pg_policies`, never from migration text: this repo rewrites function and
-- policy bodies at runtime, so a predicate rebuilt from an earlier file silently reverts
-- whatever landed in between.
--
-- ⚠ WHAT IS DELIBERATELY *NOT* CHANGED, and why the omission is the decision:
--
--   * `hospital_affiliations_select` and `organization_affiliations_select` keep showing
--     voided rows to their own audience. D7's record-vs-contribution asymmetry: what a
--     void revokes is what the row GRANTED, never the record that it happened. The row
--     stays visible, badged *Anulado*, so an administrator can see the correction rather
--     than watch evidence disappear.
--   * The MEMBERSHIPS-DERIVED hospital-admin leg (`hm` LEFT JOIN `hc`) in all three
--     policies is untouched. It never reads `hospital_affiliations`, so a void cannot and
--     should not affect it — someone who reaches the person through a live seat still
--     reaches them. This is coherent with D8, which refuses to void any affiliation whose
--     principal ever held a membership under that scope: "never employed" and "held a
--     seat" are not both true of the same person.
--   * No `expires_at` filter is added anywhere (D6): ever-held reads make read-side
--     expiry filtering incoherent, and that ruling closes
--     `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS`.
--   * The org-admin legs still key on `profiles.home_organization_id`. D10 demotes that
--     column but explicitly keeps every existing RLS leg on it; migrating the legs and the
--     tenant trigger is the named Phase 2 follow-on.
--
-- ⚠ `professional_credentials_select` leg 1 uses a bare `auth.uid()` where the two
-- `profiles` policies use `( SELECT auth.uid() )` — a per-row evaluation instead of a
-- hoisted InitPlan. It is re-emitted here EXACTLY AS IT IS. Fixing it would be a second,
-- unreviewed change riding inside a security migration; it is filed as its own follow-up.
--
-- Proof: supabase/tests/374_c5_voided_affiliation_read_differential.sql — a DIFFERENTIAL,
-- not a post-state. Observed RED at 2/15 before this migration, with §1.1-1.4 proving the
-- read exists and survives an END (C5 itself), §2.3 proving the voided row stays visible,
-- and §3.1-3.2 proving the org-admin route is unaffected. The keystone depends on nothing
-- else in this commit, so reverting this file alone re-reds it.

-- ---------------------------------------------------------------------------------------------
-- 1. profiles_admin_select — leg 4 of 5
-- ---------------------------------------------------------------------------------------------

alter policy profiles_admin_select on public.profiles
  using (
    app.is_admin()
    OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))
    OR (EXISTS ( SELECT 1
       FROM (memberships cm
         JOIN commissions c ON ((c.id = cm.commission_id)))
      WHERE ((cm.commission_id IS NOT NULL) AND (cm.principal_id = profiles.id) AND app.is_tenancy_admin_of(c.id))))
    OR (EXISTS ( SELECT 1
       FROM hospital_affiliations ha
      WHERE ((ha.principal_id = profiles.id) AND (ha.voided_at IS NULL) AND app.is_hospital_admin_of(ha.hospital_id))))
    OR (EXISTS ( SELECT 1
       FROM (memberships hm
         LEFT JOIN commissions hc ON ((hc.id = hm.commission_id)))
      WHERE ((hm.principal_id = profiles.id) AND (COALESCE(hm.hospital_id, hc.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm.hospital_id, hc.hospital_id)))))
  );

-- ---------------------------------------------------------------------------------------------
-- 2. profiles_select_self_or_admin — leg 5 of 6
-- ---------------------------------------------------------------------------------------------

alter policy profiles_select_self_or_admin on public.profiles
  using (
    (id = ( SELECT auth.uid() AS uid))
    OR ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))
    OR (EXISTS ( SELECT 1
       FROM (memberships cm
         JOIN commissions c ON ((c.id = cm.commission_id)))
      WHERE ((cm.commission_id IS NOT NULL) AND (cm.principal_id = profiles.id) AND app.is_tenancy_admin_of(c.id))))
    OR (app.is_active(( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
       FROM memberships them
      WHERE ((them.commission_id IS NOT NULL) AND (them.principal_id = profiles.id) AND app.is_member_of(them.commission_id)))))
    OR (EXISTS ( SELECT 1
       FROM hospital_affiliations ha
      WHERE ((ha.principal_id = profiles.id) AND (ha.voided_at IS NULL) AND app.is_hospital_admin_of(ha.hospital_id))))
    OR (EXISTS ( SELECT 1
       FROM (memberships hm
         LEFT JOIN commissions hc ON ((hc.id = hm.commission_id)))
      WHERE ((hm.principal_id = profiles.id) AND (COALESCE(hm.hospital_id, hc.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm.hospital_id, hc.hospital_id)))))
  );

-- ---------------------------------------------------------------------------------------------
-- 3. professional_credentials_select — leg 4 of 5
-- ---------------------------------------------------------------------------------------------

alter policy professional_credentials_select on public.professional_credentials
  using (
    (user_id = auth.uid())
    OR app.is_admin()
    OR (EXISTS ( SELECT 1
       FROM profiles p
      WHERE ((p.id = professional_credentials.user_id) AND (p.home_organization_id IS NOT NULL) AND app.is_org_admin_of(p.home_organization_id))))
    OR (EXISTS ( SELECT 1
       FROM hospital_affiliations ha
      WHERE ((ha.principal_id = professional_credentials.user_id) AND (ha.voided_at IS NULL) AND app.is_hospital_admin_of(ha.hospital_id))))
    OR (EXISTS ( SELECT 1
       FROM (memberships hm
         LEFT JOIN commissions hc ON ((hc.id = hm.commission_id)))
      WHERE ((hm.principal_id = professional_credentials.user_id) AND (COALESCE(hm.hospital_id, hc.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm.hospital_id, hc.hospital_id)))))
  );
