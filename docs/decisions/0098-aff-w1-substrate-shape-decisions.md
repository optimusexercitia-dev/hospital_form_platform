# ADR 0098 — AFF W1 substrate: five shape decisions ADR 0097 left open

**Status:** Accepted (build-time, `backend`, W1) · **Date:** 2026-08-06
**Scope:** implements ADR [0097](./0097-hospital-affiliation-person-identity.md) D1–D7 + D15.
Migrations `20260909000100` / `000200` / `000300` / `000400`; keystones
`supabase/tests/301_hospital_affiliation_substrate.sql`.

ADR 0097 fixes *what* the substrate is. Five choices it does not settle were made while
building it; each is recorded here rather than only in a migration comment, because
each is a place a later reader could "fix" the code back into a defect.

1. **The `hospital_affiliations` SELECT policy's affiliation leg is ROW-scoped, not
   principal-scoped.** The plan phrases it as "the principal has an active affiliation
   to a hospital I administer". Transcribed literally onto `hospital_affiliations`
   itself that is a policy on T reading T — infinite policy recursion (42P17) unless
   laundered through a new `SECURITY DEFINER` helper, i.e. a new `prosecdef` gate to
   census, sweep and keystone forever. The leg is therefore
   `app.is_hospital_admin_of(hospital_id)` — *this row's* hospital. Nothing is lost:
   the reach a principal-scoped leg would add (seeing a person's affiliations at
   hospitals I do not administer) is served by the W2 directory door `list_org_people`
   (D10/D11), which is deliberately wider than the table policy. The membership leg
   stays principal-scoped — it must, since it is what closes finding 3.
2. **`app.is_admin()` is NOT a leg of that policy.** D6 specifies four legs.
   platform_admin's noun (tenancy + identity, ADR 0078 A35) arguably covers employment
   rows, but no decision of record says so, and an undeclared fifth leg is the
   drive-by widening ADR 0079 exists to catch. Adding it later is a one-line amendment
   with its own keystone.
3. **The `profiles` grant conversion revokes SELECT/INSERT/UPDATE only.** DELETE,
   TRUNCATE, TRIGGER and REFERENCES stay table-level, so REFERENCES still covers `cpf`.
   That is inert **because `authenticated` holds no CREATE on schema `public`** and so
   cannot build a referencing table to use as an existence oracle. The premise is
   asserted executably (pgTAP `301` §0.9), not left in a comment — a load-bearing claim
   in prose goes stale in silence.
4. **`updateUserProfile` with a null hospital does NOT end an affiliation.** Ending is
   a governed act with its own refusals (D5: refused while the person holds active
   memberships of any tier under that hospital) and belongs to the W2 `end_affiliation`
   door. A profile edit that happens to omit a field must not revoke employment as a
   side effect. The action's `homeHospitalId` therefore means *ensure*, never *replace*.
5. **`professional_profiles.cpf` carries no unique index** (D15 is "column only").
   `profiles.cpf` is unique because it is the PERSON key; `professional_profiles` rows
   are org-scoped case-subject records whose only writer is
   `create_professional_profile`, and uniqueness over them is a linking decision D15
   defers to FUP-ETH-1. Additive later.

## Consequence recorded, not discovered later

`20260909000300` removes the `home_hospital_id` leg from both `profiles` SELECT
policies and adds nothing — the replacement legs are W2/T2.3. On the seeded population
this loses nothing (measured: `hospitaladmin.a1` reads 13/30 profiles and 21/34
memberships both before and after, the exact constants ADR 0097 finding 3 cites). On
the **product path** it does: a person registered at a hospital and seated on no
committee was read through that leg, and between W1 and T2.3 their hospital's admin
cannot read their profile. ADR 0097 finding 2 calls the leg "inert" on the strength of
the seed being 1/30 populated — that measures the seed, not the flow. pgTAP `301` §5.1
pins the gap, and **W2/T2.3 must invert that assertion**; it is the executable form of
this paragraph, not a property worth keeping.
