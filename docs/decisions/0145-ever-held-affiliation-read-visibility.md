# 0145 — Ever-held affiliation as the person-read boundary

**Status:** Accepted · 2026-08-25
**Supersedes:** nothing. **Amends:** 0097 (AFF, the affiliation read-visibility input), 0133 (AFF2 D13, the mirrored credentials leg).

## Context

ADR 0097 made hospital **affiliation** an input to read visibility. It was implemented in
the present tense. The affiliation leg of both `public.profiles` SELECT policies — and,
after ADR 0133 D13 Amdt 2, of `professional_credentials_select` — read:

```sql
exists (select 1 from hospital_affiliations ha
         where ha.principal_id = profiles.id
           and ha.ended_on is null                      -- ← the cliff
           and app.is_hospital_admin_of(ha.hospital_id))
```

`end_affiliation` is the documented hospital-admin offboarding action (ADR 0133 AFF2: a
hospital admin's local offboarding is `end_affiliation`, never deactivation). So the
primary offboarding flow **destroyed the actor's own access to its result**. The instant
the affiliation ended, the person left that admin's RLS scope: the flow's redirect landed
on a 404, and the person-detail page's affiliation-history card — whose entire purpose is
to render `Encerrado` rows — became unreachable for the only role that produces them.

Measured against the seed (`hospitaladmin.a1` vs `dr.john`, rolled back, harness
preconditions asserted):

| state | `profiles` rows visible |
| --- | --- |
| affiliation active, 2 commission seats | 1 |
| all commission seats removed | 1 |
| + the affiliation ended | **0** |
| same state, seen by an `org_admin` | 1 |

The `org_admin` row is why this was hospital-admin-only: the `home_organization_id` leg
carries org admins across the cliff, so nobody with org scope could see the defect.

**⭐ And the platform already contradicted itself about it.** `public.list_org_people` is
`SECURITY DEFINER` and its gate is **org**-scoped — it never filtered affiliation at all
(its only `ended_on is null` sits inside the display payload naming a person's *current*
hospitals). So the departed person kept appearing in the hospital admin's directory
listing while `profiles` returned zero rows. **The platform listed people you could not
open.** Measured on the ADR-0145 test fixture before the change: five such orphan listings
for a single admin.

That is this repo's standing lesson landing again — **`prosecdef` belongs beside
`pg_policies`** (ADR 0078 methodology finding, ADR 0079). The DEFINER door and the RLS
policy encoded two different answers to "who may this admin see", and only the door had
ever been consulted when the directory was specified.

## Decision

1. **The affiliation read leg becomes EVER-HELD, not currently-held.** The single conjunct
   `and ha.ended_on is null` is removed from the affiliation leg of
   `profiles_admin_select`, `profiles_select_self_or_admin`, and
   `professional_credentials_select`. Nothing else in any predicate changes. A hospital
   admin may see people who **ever** held an affiliation to a hospital they administer.

2. **Both `profiles` SELECT policies move together.** They are permissive and OR'd, so
   widening either one alone satisfies every behavioural test while leaving the other
   narrow. This is asserted per policy, by name, in
   `supabase/tests/368_offboarded_person_visibility.sql` §5 — verified by mutation to be
   the *only* thing that catches a half-applied migration (widening just
   `profiles_admin_select` leaves arms 1.1, 1.2, 2.2, 2.3 and 3.4 green).

3. **`professional_credentials_select` changes too — as its own decision, not a
   ride-along.** Council registrations are **Class-2 professional-identity data**
   (Architecture Rule 12; ADR 0064/0065), and the consequence is explicit: *an
   ex-employee's council registration number becomes readable by an admin of a hospital
   they used to work at.*

   It is changed because **not** changing it re-creates the exact defect that leg was
   written to remove. Migration `20261003001100` (ADR 0133 D13 Amdt 2) added it so the
   policy would mirror the two `profiles` legs verbatim — before it, a hospital admin
   could read a profile but not the credential, and the "Registro" column rendered an
   em-dash: **an empty cell silently meaning "no permission"**, the state this codebase
   bans. Widening `profiles` alone would reinstate that em-dash for every departed person,
   one release after it was fixed. The mirror is the invariant.

4. **The bound that makes it safe: the leg stays keyed to
   `app.is_hospital_admin_of(ha.hospital_id)`.** The change alters the *tense* of the
   affiliation test, never its *hospital scope*. The rule is **"people who worked HERE"**,
   never "people who work anywhere". A sibling hospital's admin in the same org still sees
   nothing; a cross-org admin still sees nothing.

5. **The widening is UNBOUNDED IN TIME, and a retention window was rejected.** The
   tempting alternative — visible for N months after `ended_on` — was refused because
   **clock-dependent RLS is untestable**: a policy whose truth value changes with
   `current_date` cannot be pinned by a keystone that means the same thing next year, and
   its expiry is unobservable until someone loses access in production. It also
   reintroduces the identical cliff, merely later and with no actor present to notice.
   Accreditation evidence is retained for 20 years (CFM 1821/2007, Rule 12); an admin who
   may audit a committee's history needs the people in it to remain resolvable.

6. **⛔ READ WIDENS. WRITE DOES NOT.** This is the whole risk of the change and the
   boundary is unmoved:
   - At the RLS layer a `hospital_admin` has **no write path to `profiles` at all** —
     `profiles_admin_update` is `app.is_admin()` and `profiles_update_self` is
     `id = auth.uid()`. This migration adds none.
   - The ADR-0133 (AFF2) capability derivation is untouched and still filters
     `ended_on is null` in `resolvePersonFootprint`. A departed person therefore has an
     **empty active footprint**, and `personScopeAllows` denies all four capabilities
     (`fields` · `credentials` · `cpf_change` · `lifecycle`) at its explicit zero-footprint
     guard. AFF2's INTERSECTION/SUBSET split is unchanged.

   Net: a hospital admin can now **open** an ex-employee's record and still cannot edit
   their name, CPF, credentials, category, account status, or affiliations.

7. **The roster readers stay present-tense, deliberately.** `listActiveAffiliationsFor`,
   `listActivePrincipalIdsForHospital`, the `affiliations` payload inside
   `list_org_people`, and the `hospital_affiliations(count)` embed behind the org_admin
   Hospitais card all keep `ended_on is null`. Visibility of a person's **record** and
   membership of a hospital's **current roster** are different questions; a departed person
   must not reappear in a staff listing.

8. **No column grants change, and that is load-bearing.** `authenticated` holds
   **column-list** SELECT on `public.profiles` which excludes `cpf`, `date_of_birth` and
   `phone`. Widening the row predicate widens exactly the eleven already-granted columns;
   the sensitive personal columns stay unreachable to `authenticated` through PostgREST for
   departed and active people alike.

## Consequences

- **The DEFINER door and the RLS policy now agree** for the population this ADR governs.
  Confirmed after the migration rather than predicted: of the people
  `list_org_people` returns, every one who ever held an affiliation to the caller's
  hospital is now openable (counterexamples before: 1; after: 0).

  ⚠ **A residual divergence remains and is NOT closed by this ADR.** Four orphan listings
  survive in the test fixture, and all four were characterised rather than explained away:
  every one is a person who **never** held an affiliation to a hospital the caller
  administers (a sibling hospital's admin, an org_admin, a person whose ended tie was to
  the sibling hospital, a person with no footprint at all). That is the org-scoped DEFINER
  directory returning the whole org's roster — pre-existing and **ratified by ADR 0097
  finding 1**, which already records that the door is deliberately wider than the
  `profiles` policy. Test 368 §2.3 was narrowed during authoring from "no orphan listings
  at all" to this bounded claim, because the broad version was a false statement about the
  platform sitting inside a keystone.

- **`FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` closes.** That follow-up recorded that three
  authorities assert "active membership" while no policy implements it, and flagged an
  asymmetry *inside* a single policy: the affiliation leg filtered activity
  (`ended_on is null`), the membership leg never filtered `expires_at`. Verified from the
  live catalog after this migration — all three policies now contain **zero** occurrences
  of `ended_on` **and** zero of `expires_at`. The asymmetry is genuinely gone, and it
  resolves in the permissive direction: the follow-up's question is answered **in the
  negative** for the read side. "Active" describes **write** authority — which does still
  filter, in `resolvePersonFootprint` — and was never the right rule for read visibility.
  A future decision to filter `expires_at` on the membership leg would now contradict this
  ADR's ever-held principle and needs its own ruling.

- **An ex-employee's record and council registration are readable by their former
  hospital's admin, indefinitely.** This is the accepted cost. It is bounded to hospitals
  the caller actually administers, it exposes no column that was not already granted, and
  it confers no write authority.

- Audit posture is unchanged: `profiles` and `professional_credentials` reads were not
  audited before this change and are not now. This ADR widens an existing read predicate;
  it does not create a new class of read.

- **Tense is a security property, and it was invisible.** The defect was one conjunct that
  read correctly in every review — "you administer this hospital, they work at it" is a
  sentence nobody objects to. What made it wrong was a *lifecycle* the predicate could not
  see. When an authorization rule references a state that an application action
  deliberately ends, check whether the actor performing that action still needs the
  visibility afterwards.
