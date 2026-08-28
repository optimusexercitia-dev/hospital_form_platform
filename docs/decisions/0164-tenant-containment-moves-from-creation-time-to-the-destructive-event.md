# 0164 — tenant containment moves from creation time to the destructive event

**Status:** Accepted · 2026-08-28
**Amends:** 0151 (D10's Phase 2 assumed the containment trigger could simply be re-predicated onto
affiliations; it cannot — measured, the predicate is unsatisfiable at creation time. This ADR
changes *when* containment is enforced, not *whether*.)
**Amends:** 0163 (records that its retention rule is enforced on the read side only until AE2.4's
increment 3 lands, and makes the capability-level differential a hard gate on the column drop.)

## Context

AE2.4 drops `profiles.home_organization_id`. Its containment trigger,
`public.assert_profile_tenant_has_org`, currently enforces *"a non-admin profile must have a
`home_organization_id`"* — a conditional NULL check on the column, `prosecdef = f`, reading **no
table at all**.

Plan AE2.2 said to re-predicate it onto "an active org affiliation". **Measured, that is not
implementable**, for two independent reasons:

1. **Two transactions, so deferral buys nothing.** `handle_new_user` inserts the `profiles` row
   inside GoTrue's `auth.users` transaction; the org affiliation is created later, by
   `affiliate_person_impl` / `affiliate_person_to_org_impl`, in a **separate PostgREST
   transaction**. `DEFERRABLE INITIALLY DEFERRED` defers to *that* transaction's COMMIT, not across
   both. An active-affiliation predicate raises on **every signup, unconditionally**.
2. **The dependency is circular.** `app.affiliate_person_to_org_impl` — the door that *creates* the
   affiliation — is itself gated on the column (`HC0R0`, *"pessoa não pertence a esta
   organização"*). Containment cannot move onto affiliations while the affiliation-creating door
   requires the column.

A third observation makes the current invariant hollow rather than merely awkward: post-ADR 0163,
*"has `home_organization_id`"* and *"some admin can reach this person"* were **the same fact** only
because of the authority leg AE2.2 deleted. Preserved unchanged, it would be ceremony.

## Decision

**Containment is re-predicated to *"≥1 non-voided organization affiliation"* and enforced on the
destructive event, not at creation.** The unsatisfiable `profiles`-INSERT arm is dropped; a
deferred constraint trigger on `organization_affiliations` void/delete takes its place. The
invariant now means *"this person is reachable by someone"*, which is what it was for.

**A mitigation is REQUIRED before the column drop — the window may exist, but it may not be
silent.** Either app-side compensation in the person-creation path, or an orphan-detection
assertion. Which one is an implementation choice; **having neither is not.**

⛔ **The security context changes in the same migration that gives the trigger a table read** —
never as a follow-up. `assert_profile_tenant_has_org` is `prosecdef = f` today, and an INVOKER
trigger reading `organization_affiliations` (SELECT policy: `principal_id = auth.uid() OR
app.is_org_admin_of(organization_id)`, **no hospital tier, by design**) reproduces
`BUG-D5-REHIRE-HOSPADMIN-001` — one-step rehire broken for every `hospital_admin` (ADR 0159).

**AE2.4 runs as four separately-gated increments, in dependency order** (PO, 2026-08-28):

1. **The circular pair** — this trigger **and** `affiliate_person_to_org_impl`'s column gate,
   together, because neither can move first.
2. *(folded into 1)*
3. **The write-authority path** — `app.can_administer_person_for` and the six AE1.3 person-door
   kernels, with a **capability-level differential** over the diverging targets. ⛔ **Hard gate on
   the drop.**
4. **`listLinkableOrgUsers`** — shape C-b′; option C-a is rejected (see Consequences).

## Consequences

- ⚠ **Creation-time containment is genuinely lost.** A half-failed person creation leaves a profile
  with no affiliation: in **no** roster (`list_org_people` filters on affiliations since AFF4 D10,
  even under `p_include_ended`), and — ⛔ **CORRECTED 2026-08-28 (QA B5), this said "administrable
  by `platform_admin` alone"** — administrable by **NOBODY**. `platform_admin` is deliberately not
  an arm of `app.can_administer_person_for` (ADR 0041's noun rule), pinned by pgTAP `384 § 6`
  asserting a platform_admin is **refused**, and the predicate returns false on an empty org set for
  every caller. The **actual** recovery is ADR 0165 D1's widening: an org_admin or hospital_admin
  **already holding the uuid** may claim the person through the affiliate door — they cannot be
  found first, so recovery requires knowing the identifier out of band. ⚠ **The false claim was
  load-bearing**: it is what made this accepted window read as tolerable when the PO ruled on it,
  and it stood in four documents. ⛔ **This window is inherent to dropping
  the column, not introduced by this decision** — closing it at creation requires having
  `handle_new_user` create the affiliation, which is **rejected**: `affiliate_person_to_org_impl`
  is idempotent on an existing active row, so it returns early and silently discards the caller's
  backdated `p_started_on` and `created_by` attribution.
- ⚠ **Such an orphan is shape-identical to a legitimate row.** Measured 2026-08-27: exactly **one**
  profile has no non-voided org affiliation, and it is the `platform_admin` — correct by design,
  since the outgoing trigger's rule is conditional on `is_admin`. Any detection must therefore
  discriminate on more than the absence of an affiliation. **This is the reason the mitigation is
  required rather than advised.**
- ⛔ **ADR 0163 is half live until increment 3.** `app.can_administer_person_for` still resolves
  `home_organization_id`, as do all six person-door kernels — so 0163's retention, which its bound 1
  scopes to exactly the SUBSET capabilities `lifecycle` and `cpf_change`, is **not in force where
  those capabilities are gated**. ⚠ **No seeded test can show this**: in `seed.sql` home org and
  retaining org always coincide. They diverge only for a person anchored to org A whose active — or
  last non-voided ended — affiliation is in org B; pgTAP `392` constructs it and it lands on 5 of 10
  targets. Without increment 3's differential the drop **silently moves write authority** instead of
  preserving it.
- ⛔ **Option C-a for `listLinkableOrgUsers` is rejected and should not be re-proposed:** adding a
  `staff_admin`/co-membership arm to `organization_affiliations_select` repairs an application read
  by **widening a tenancy policy**, against an ADR that says "no hospital tier, **by design**"
  (0151 D1). A policy widened for a picker stays widened for everything else it gates. C-b′ — a
  `public` INVOKER wrapper over a `bool` `app` DEFINER predicate — preserves the perimeter,
  discloses nothing, and is the shape `ARM=wrapper` already sweeps (ADR 0079 Amendment 7).
- **Separately gated increments** cost more wall-clock than one migration set and buy
  attributability across a change touching 12 functions — the plan's slicing rule ([PA-F18]).
