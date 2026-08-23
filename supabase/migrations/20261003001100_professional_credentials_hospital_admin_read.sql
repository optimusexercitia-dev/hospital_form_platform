-- AFF2 B2 — `professional_credentials_select` gains a hospital-admin affiliation leg and
-- membership leg. ADR 0133 D13, as resolved by Amendment 2 (PO-ruled 2026-08-23).
--
-- THE PROBLEM THIS CLOSES. `professional_credentials` SELECT admitted self /
-- platform_admin / org_admin-of-home-org only. A hospital_admin could already read a
-- person's `profiles` row — both live `profiles` SELECT policies carry hospital-admin legs
-- (AFF, ADR 0097) — but not their credential row. Measured on the pre-migration catalog:
-- `hospitaladmin.a1` reads 1 `profiles` row for a committee-seated person and 0 of that
-- person's credentials. The redesign's "Registro" column therefore rendered an em-dash for
-- every hospital admin, which is the "empty never means no-permission" state this codebase
-- bans (ADR 0133's Alternatives table rejects hiding the column for exactly this reason).
--
-- ⛔ WHY THE MEMBERSHIP LEG IS WIDER THAN ADR 0133 D1/D2 AND THAT IS CORRECT.
-- READ authority and WRITE authority are deliberately different here, and the leg below
-- looks like a bug against D2 if that is forgotten:
--   · D1(b)/D2 bound who may ADMINISTER a person — all memberships commission-tier, whole
--     footprint inside the caller's hospitals, any org-tier or hospital-tier seat pushing
--     the person to org_admin-only. Amendment 1 ruling 1 then aligned the widened WRITES to
--     "the read boundary D13 already draws".
--   · Nothing in D2 says a hospital-tier person's credentials are UNREADABLE. It says they
--     cannot be administered. Reading a colleague's council registration number at a
--     hospital you administer is not administering them.
-- So these two legs MIRROR the live `profiles` SELECT legs verbatim — including
-- `COALESCE(hm.hospital_id, hc.hospital_id)`, which admits hospital-tier membership rows.
-- Narrowing to commission-tier would leave a technical_director at the caller's OWN
-- hospital with a readable profile row and a blank Registro cell: a fresh instance of the
-- exact trap this migration removes. PO-ruled MIRROR on 2026-08-23; the ALLOW arm that
-- pins the hospital-tier case is `360_credentials_hospital_admin_read.sql` §3.
--
-- ⚠ AN ASYMMETRY NOW LIVES INSIDE THIS ONE POLICY, and it is deliberate. The AFFILIATION
-- leg filters activity (`ended_on is null`); the MEMBERSHIP leg does NOT filter
-- `expires_at`. Neither live `profiles` policy filters `expires_at` anywhere, and adding
-- the filter here alone would make two policies silently disagree about what "active"
-- means while the expired-membership person still reaches the directory through `profiles`
-- with a blank Registro cell. Tracked for BOTH policies together as
-- FUP-AFF2-ACTIVE-MEANS-TWO-THINGS. Do not "fix" it on one side.
--
-- ⛔ THE THREE EXISTING LEGS ARE RE-EMITTED FROM THE LIVE `pg_policy`, not from migration
-- text (stale by design in this repo). `alter policy` replaces the WHOLE using-expression,
-- so a leg lost in transcription would be invisible to every new-leg test — §5 of the
-- keystone file exercises all three originals for that reason.
--
-- Scope: SELECT only. No write policy is added; credential writes stay off the RLS path.

alter policy professional_credentials_select
  on public.professional_credentials
  using (
    -- ── the three ORIGINAL legs, re-emitted verbatim from pg_policy ──────────────
    (user_id = auth.uid())
    or app.is_admin()
    or exists (
      select 1
        from public.profiles p
       where p.id = professional_credentials.user_id
         and p.home_organization_id is not null
         and app.is_org_admin_of(p.home_organization_id)
    )
    -- ── AFF2 B2 leg 1: AFFILIATION (ADR 0133 D13) ───────────────────────────────
    -- The person is actively affiliated with a hospital the caller administers. This is
    -- the leg that reaches a person with no committee seat at all — the hire whose
    -- Registro cell would otherwise be blank on their first day.
    or exists (
      select 1
        from public.hospital_affiliations ha
       where ha.principal_id = professional_credentials.user_id
         and ha.ended_on is null
         and app.is_hospital_admin_of(ha.hospital_id)
    )
    -- ── AFF2 B2 leg 2: MEMBERSHIP (ADR 0133 D13 + Amendment 2) ──────────────────
    -- The person holds a seat whose hospital the caller administers, resolved either
    -- directly (hospital-tier rows) or through the commission (commission-tier rows).
    -- The COALESCE is the mirror of `profiles`; see the header for why hospital-tier is
    -- admitted deliberately rather than by accident.
    or exists (
      select 1
        from public.memberships hm
        left join public.commissions hc on hc.id = hm.commission_id
       where hm.principal_id = professional_credentials.user_id
         and coalesce(hm.hospital_id, hc.hospital_id) is not null
         and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id))
    )
  );

comment on table public.professional_credentials is
  'Professional council registrations (CRM/COREN/...). SELECT admits FIVE legs: self, '
  'platform_admin, org_admin of the owner''s home org, and — since AFF2 B2 (ADR 0133 D13 + '
  'Amendment 2) — a hospital_admin reaching the owner through an active hospital '
  'affiliation or through a seat at a hospital they administer. The two hospital-admin legs '
  'MIRROR the live `profiles` SELECT legs exactly, hospital-tier memberships included: read '
  'authority here is deliberately WIDER than the D1/D2 authority to ADMINISTER a person, '
  'because a readable profile row beside an unreadable credential row is the '
  '"empty means no-permission" trap. Writes are not on the RLS path — this table has no '
  'INSERT/UPDATE/DELETE policy.';
