# 0166 — governance-role provisioning implies an organization affiliation

**Status:** Accepted · 2026-08-28
**Amends:** 0164 (its accepted orphan window was premised on a *half-failed creation* being
exceptional; measured, every admin-provisioned person landed in that state permanently once the
column drops. This ADR removes the routine population from that window and corrects the window's
stated grain.)
**Amends:** 0151 (organization affiliation gains a second producer: governance-role provisioning,
alongside the explicit affiliate doors.)

## Context

QA round 2 (R2-B1) measured that `assignStaffAdmin` and `assignOrgAdmin` provision a person via
`resolveOrInviteUser`, grant a membership through the sanctioned role doors, and **never create an
affiliation** — verified: zero affiliate calls in either file, and `handle_new_user` writes none.

`profiles.home_organization_id` currently masks this. After AE2's drop, every person provisioned
this way is **permanently** the state ADR 0164 accepted as a *transient* window: refused by all six
person-authority doors, absent from every roster and both pickers, and reported forever by
`app.tenant_orphan_profiles()`, which cannot distinguish them from genuine creation orphans.

⛔ **That invalidates the premise the window was accepted on.** A detector whose output is dominated
by routine successful users trains operators to ignore it. The phase engineered this population's
*admit* side and never its *administer/visibility* side.

## Decision

> **Assigning `org_admin` or `staff_admin` to a tenant person also establishes an active
> organization affiliation with the organization that owns the granted scope. The affiliation is an
> organization-level tenant relationship, not a hospital-employment assertion. It locates the
> person for visibility and lifecycle administration; the membership remains the sole source of
> role capability.**

Eight clauses, each binding:

1. The implied row is an **`organization_affiliations` row only**. It does not invent a
   `hospital_affiliations` row, employee number, hospital, job title, or hospital employment.
2. A successful role provisioning leaves **both** the required affiliation and the membership, or
   **neither** database row.
3. Repeating the operation is **idempotent**.
4. An **ended, non-voided** affiliation in the same organization is reactivated by creating a **new
   active row**; history is not rewritten.
5. A person whose non-voided affiliations are entirely in **another** organization remains
   **refused**.
6. A **platform administrator's** identity cannot be bound into a tenant as the target person.
7. `created_by` records the **real provisioning actor**. ⛔ Never name the provisioned person as
   actor to get around an authority check.
8. Until a start-date input exists on these two flows, the new affiliation begins on the **role
   provisioning date**. Historical backfill dates are ruled separately.

**Scope bound:** this implication covers exactly `organization`/`org_admin` and
`commission`/`staff_admin`. ⛔ It does **not** extend to every membership role — technical-director,
NSP, quality and ordinary `staff` appointments have their own semantics and need their own ruling.

## Consequences

- ✅ **The model's separation is preserved, not weakened.** `profiles` = the identity exists;
  `organization_affiliations` = the person is **known to** an organization (locates them for roster,
  visibility and lifecycle authority); `memberships` = the person **holds a role** (grants
  capability). Affiliation still confers no role — **Architecture Rule 13 is untouched**. Provisioning
  merely creates *both* facts, because the product now declares that this appointment implies the
  tenant relationship.
- ✅ **The detector becomes exceptional again**, which is what ADR 0164's choice of detection over
  compensation depends on.
- ⚠ **It changes what an administrative appointment means in the real world**, and it is hard to
  reverse after a backfill — which is why it is an ADR rather than a local repair.
- ⚠ **The behaviour belongs in the shared kernel, not the two callers.** A fix in TypeScript alone
  leaves `app.grant_role_impl` able to recreate the same state, and a second `affiliate_person_to_org`
  call would be a **second transaction** — recreating the membership-without-affiliation failure it
  is meant to remove. ⛔ And it must **not** be implemented by adding a platform-admin arm to the
  ordinary affiliation door: that would broaden employment/affiliation authority far beyond this
  decision.
- ⛔ **Option 2 (an explicit affiliation-less governance-principal population) is NOT adopted, and
  must not be encoded as the absence of an affiliation row.** If such a population is ever real, it
  needs its own principal kind, directory, lifecycle and detector discrimination — because
  *"currently holds a membership"* is not a durable discriminator: removing the last membership makes
  the person indistinguishable from a crash orphan again.
- ⛔ **Option 3 (excluding membership holders from the detector) is rejected as a fix.** It
  suppresses the symptom, restores neither roster nor picker nor person administration, and would
  hide a genuine membership-succeeded / affiliation-failed partial write.

## The grain correction this ADR also carries (QA B5)

ADR 0164 said an orphan is *"administrable by `platform_admin` alone"*; that was corrected to
*"administrable by NOBODY"*; **both are wrong without a grain.** Measured: `profiles_admin_update` is
`USING app.is_admin()`, so a platform administrator retains **limited direct-table updates** on
selected profile columns. The accurate statement, which supersedes both:

> **Nobody can administer the person through the six person-authority doors; a platform administrator
> retains limited direct-table updates on selected profile columns** (rename, re-email, deactivate,
> demote) **and still cannot exercise door-gated capabilities such as CPF and credential changes.**

⚠ The live catalog comment on `app.tenant_orphan_profiles()` still carries the original false
sentence. ⛔ It is corrected by a **forward migration** — the already-applied `20261003005600` is
never edited in place.

## Still owed before the column drop, and NOT discharged by this ADR

- **R2-B1's existing-data repair** — routine candidates derived **by property**, classified into
  buckets, and repaired or explicitly ruled. ⛔ The backfill is **not** "all detector rows".
- **The `is_admin: true → false` demotion transition** (round-2 CNV-5): measured reachable, and it
  creates an unchecked orphan. Needs a DEFINER, pinned-`search_path` backstop — ⛔ an INVOKER trigger
  reading affiliations reproduces ADR 0159's failure mode.
- **Detector logging** must stop enumerating platform-wide orphan UUIDs in any organization's request
  path.
- **ADR 0165's M11 capability gain** — an actor who already knows an orphan uuid claiming it through
  the ordinary affiliate door — is **recorded but not accepted**, and its PO ruling remains a hard
  pre-drop condition independent of this decision.
