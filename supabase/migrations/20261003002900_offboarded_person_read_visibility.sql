-- AFF3 — a hospital_admin keeps READ visibility of a person who EVER held an affiliation
-- to a hospital they administer. ADR 0148 (amends ADR 0097 AFF, ADR 0133 AFF2 D13).
--
-- THE DEFECT. `end_affiliation` is the documented hospital-admin offboarding action, and
-- it was self-defeating: the affiliation leg of the person-read policies tested affiliation
-- in the PRESENT TENSE (`ha.ended_on IS NULL`), so the instant an admin offboarded someone
-- the person left their RLS scope. The offboarding flow's own redirect landed on a 404, and
-- the person-detail page's affiliation-history card — whose entire purpose is to render
-- `Encerrado` rows — became unreachable for the only role that performs offboarding.
--
-- ⭐ AND THE PLATFORM CONTRADICTED ITSELF. `public.list_org_people` is SECURITY DEFINER and
-- its gate is ORG-scoped; it never filtered affiliation at all. So the departed person kept
-- appearing in the hospital admin's directory listing while `profiles` returned zero rows —
-- the directory listed people you could not open. Measured on the 371 fixture before this
-- migration: FIVE such orphan listings for a single admin. The DEFINER door and the RLS
-- policy disagreed, and only the door had ever been consulted (this repo's standing lesson
-- that `prosecdef` belongs beside `pg_policies`). After this migration they agree.
--
-- THE CHANGE. Exactly one conjunct — `AND ha.ended_on IS NULL` — is removed from the
-- affiliation leg of THREE policies. Nothing else in any predicate moves. Each USING
-- expression below was re-emitted from the LIVE `pg_policies.qual` rather than copied from
-- an older migration file, because migration text in this repo is stale by design.
--
-- Read as a rule: a hospital admin may see people who EVER worked at a hospital they
-- administer. The leg stays keyed to `app.is_hospital_admin_of(ha.hospital_id)`, so the
-- bound is "people who worked HERE", never "people who work anywhere".
--
-- ⛔ READ WIDENS. WRITE DOES NOT. There is deliberately no change to any write path:
--   · At the RLS layer a hospital_admin has no write path to `profiles` in the first place
--     (`profiles_admin_update` is `app.is_admin()`; `profiles_update_self` is
--     `id = auth.uid()`), and this migration adds none.
--   · The ADR-0133 (AFF2) capability derivation is unchanged and still filters
--     `ended_on IS NULL` in `resolvePersonFootprint` (`src/lib/users/person-footprint.ts`).
--     A departed person therefore has an EMPTY active footprint, and `personScopeAllows`
--     denies all four capabilities (`fields` · `credentials` · `cpf_change` · `lifecycle`)
--     at its explicit zero-footprint guard. A hospital admin can now READ an ex-employee's
--     record and still cannot edit their name, CPF, credentials, category, account status,
--     or affiliations.
-- Proof: `supabase/tests/371_offboarded_person_visibility.sql` §4 (RLS layer) and
-- `src/lib/users/departed-person-footprint.test.ts` (the AFF2 derivation — written so it
-- FAILS if the `ended_on` filter is deleted from the resolver, verified by mutation).
--
-- ⚠ WHAT THIS DOES **NOT** WIDEN — the roster readers stay present-tense on purpose, so a
-- departed person does NOT reappear in a hospital's staff listing:
-- `listActiveAffiliationsFor`, `listActivePrincipalIdsForHospital`, the `affiliations` jsonb
-- payload inside `list_org_people`, and the `hospital_affiliations(count)` embed behind the
-- org_admin Hospitais card. Visibility of a person's RECORD and membership of a hospital's
-- CURRENT roster are different questions, and this migration answers only the first.
--
-- ⚠ NO COLUMN GRANT CHANGES, AND THAT IS LOAD-BEARING. `authenticated` holds COLUMN-LIST
-- SELECT on `public.profiles` which EXCLUDES `cpf`, `date_of_birth` and `phone`. Widening
-- the row predicate therefore widens exactly the eleven already-granted columns; the
-- sensitive personal columns remain unreachable to `authenticated` through PostgREST for
-- departed and active people alike.

-- ---------------------------------------------------------------------------
-- 1/3 · public.profiles — `profiles_admin_select`
-- ---------------------------------------------------------------------------
alter policy profiles_admin_select on public.profiles
using (
  app.is_admin()
  or ((home_organization_id is not null) and app.is_org_admin_of(home_organization_id))
  or (exists ( select 1
       from (memberships cm
         join commissions c on ((c.id = cm.commission_id)))
      where ((cm.commission_id is not null) and (cm.principal_id = profiles.id) and app.is_tenancy_admin_of(c.id))))
  -- AFF3: the ONLY edit — `and (ha.ended_on is null)` removed. Ever-held, not currently-held.
  or (exists ( select 1
       from hospital_affiliations ha
      where ((ha.principal_id = profiles.id) and app.is_hospital_admin_of(ha.hospital_id))))
  or (exists ( select 1
       from (memberships hm
         left join commissions hc on ((hc.id = hm.commission_id)))
      where ((hm.principal_id = profiles.id) and (coalesce(hm.hospital_id, hc.hospital_id) is not null) and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id)))))
);

-- ---------------------------------------------------------------------------
-- 2/3 · public.profiles — `profiles_select_self_or_admin`
--
-- ⚠ BOTH profiles SELECT policies are PERMISSIVE and OR'd together, so widening only one
-- would still make every behavioural assertion pass while leaving the other narrow. They
-- must move together; test 371 §5 asserts each BY NAME for exactly this reason.
-- ---------------------------------------------------------------------------
alter policy profiles_select_self_or_admin on public.profiles
using (
  (id = ( select auth.uid() as uid))
  or ((home_organization_id is not null) and app.is_org_admin_of(home_organization_id))
  or (exists ( select 1
       from (memberships cm
         join commissions c on ((c.id = cm.commission_id)))
      where ((cm.commission_id is not null) and (cm.principal_id = profiles.id) and app.is_tenancy_admin_of(c.id))))
  or (app.is_active(( select auth.uid() as uid)) and (exists ( select 1
       from memberships them
      where ((them.commission_id is not null) and (them.principal_id = profiles.id) and app.is_member_of(them.commission_id)))))
  -- AFF3: the ONLY edit — `and (ha.ended_on is null)` removed.
  or (exists ( select 1
       from hospital_affiliations ha
      where ((ha.principal_id = profiles.id) and app.is_hospital_admin_of(ha.hospital_id))))
  or (exists ( select 1
       from (memberships hm
         left join commissions hc on ((hc.id = hm.commission_id)))
      where ((hm.principal_id = profiles.id) and (coalesce(hm.hospital_id, hc.hospital_id) is not null) and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id)))))
);

-- ---------------------------------------------------------------------------
-- 3/3 · public.professional_credentials — `professional_credentials_select`
--
-- ⛔ A DIFFERENT DATA CLASS, CHANGED DELIBERATELY AND NOT AS A SIDE EFFECT. Council
-- registrations are Class-2 professional-identity data (Architecture Rule 12; ADR
-- 0064/0065), so this is its own decision: an ex-employee's registration number becomes
-- readable by an admin of a hospital they used to work at.
--
-- It is changed because NOT changing it re-creates the exact bug this policy's affiliation
-- leg was written to remove. Migration 20261003001100 (ADR 0133 D13 Amdt 2) added that leg
-- so it would MIRROR the two `profiles` legs verbatim — before it, a hospital admin could
-- read a person's profile but not their credential, and the "Registro" column rendered an
-- em-dash: an empty cell silently meaning "no permission", the state this codebase bans.
-- Widening `profiles` alone would reinstate precisely that em-dash for every departed
-- person. The mirror is the invariant; keeping it is what makes this safe.
--
-- The bound is identical to the profiles legs — `app.is_hospital_admin_of(ha.hospital_id)`
-- — so it reaches people who worked at the caller's own hospitals and no one else.
-- ---------------------------------------------------------------------------
alter policy professional_credentials_select on public.professional_credentials
using (
  (user_id = auth.uid())
  or app.is_admin()
  or (exists ( select 1
       from profiles p
      where ((p.id = professional_credentials.user_id) and (p.home_organization_id is not null) and app.is_org_admin_of(p.home_organization_id))))
  -- AFF3: the ONLY edit — `and (ha.ended_on is null)` removed.
  or (exists ( select 1
       from hospital_affiliations ha
      where ((ha.principal_id = professional_credentials.user_id) and app.is_hospital_admin_of(ha.hospital_id))))
  or (exists ( select 1
       from (memberships hm
         left join commissions hc on ((hc.id = hm.commission_id)))
      where ((hm.principal_id = professional_credentials.user_id) and (coalesce(hm.hospital_id, hc.hospital_id) is not null) and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id)))))
);

-- ---------------------------------------------------------------------------
-- Post-condition guard. The three predicates above are LITERALS, so a drift between what
-- was live when they were read and what is live when they are applied would be silently
-- overwritten rather than reported. This block re-reads the catalog and raises if the
-- intended shape did not land: each leg must still EXIST (a migration that deleted the leg
-- instead of the conjunct would satisfy every behavioural test for the wrong reason — by
-- admitting nobody through it) and must no longer test `ended_on`.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname, qual
    from pg_policies
    where (tablename, policyname) in (
      ('profiles',                 'profiles_admin_select'),
      ('profiles',                 'profiles_select_self_or_admin'),
      ('professional_credentials', 'professional_credentials_select')
    )
  loop
    if r.qual not like '%hospital_affiliations%' then
      raise exception 'AFF3: % on % lost its hospital_affiliations leg entirely', r.policyname, r.tablename;
    end if;
    if r.qual like '%ended_on%' then
      raise exception 'AFF3: % on % still filters ended_on after the rewrite', r.policyname, r.tablename;
    end if;
  end loop;

  if (select count(*) from pg_policies
       where (tablename, policyname) in (
         ('profiles',                 'profiles_admin_select'),
         ('profiles',                 'profiles_select_self_or_admin'),
         ('professional_credentials', 'professional_credentials_select'))) <> 3 then
    raise exception 'AFF3: expected all three target policies to exist';
  end if;
end $$;

comment on policy profiles_admin_select on public.profiles is
  'AFF3/ADR 0148: the hospital-affiliation leg is EVER-HELD, not currently-held — a hospital_admin keeps read visibility of people who once worked at a hospital they administer, so offboarding via end_affiliation does not 404 its own actor. Read only; write authority is unchanged and still derives from the ACTIVE footprint (ADR 0133).';

comment on policy profiles_select_self_or_admin on public.profiles is
  'AFF3/ADR 0148: same ever-held affiliation leg as profiles_admin_select. Both profiles SELECT policies are permissive and OR''d, so they must be widened together or behavioural tests pass while one stays narrow.';

comment on policy professional_credentials_select on public.professional_credentials is
  'AFF3/ADR 0148: the affiliation leg is EVER-HELD, mirroring the two profiles SELECT policies. The mirror is the invariant (ADR 0133 D13 Amdt 2) — narrowing this policy alone reinstates the blank "Registro" em-dash that reads as "no permission".';
