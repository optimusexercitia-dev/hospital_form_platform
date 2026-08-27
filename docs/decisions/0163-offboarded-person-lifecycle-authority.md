# 0163 — lifecycle authority over a fully-offboarded person: last-org retention

**Status:** Accepted · 2026-08-27
**Amends:** 0151 (D10 left "who may still administer a fully-offboarded person" explicitly open,
to be re-answered by its Phase 2; this ADR answers it, and replaces the *mechanism* by which the
answer is reached — `profiles.home_organization_id` → a row in `organization_affiliations`.)

## Context

Phase AE2 of the authorization-evolution program (ADR 0155 D8/D3, plan task AE2.0) moves every
remaining visibility and containment decision off `profiles.home_organization_id` and then drops
the column. ADR 0151 D10 named the open question this forces:

> **Phase 2** (migrating those legs + the tenant trigger off the column) is a **named follow-on**
> … and it must explicitly re-answer lifecycle authority over fully offboarded persons, which
> until then resolves through `home_organization_id`.

**The question is not "should offboarded persons be administrable". It is "what replaces the
authority AE2 is about to delete".** That distinction is load-bearing and was measured, not assumed:

- `authorizePersonScopedAdmin` (`src/lib/users/actions.ts:379-389`) resolves the target's
  `home_organization_id` **first** and returns `{ok:false}` when it is null; it then grants outright
  on `if (await authorizeOrgOps(orgId)) return { ok: true, orgId }`. **That arm carries no
  affiliation term at all.**
- So today a fully-offboarded person **is** administrable — by an `org_admin` of their
  `home_organization_id` — and *only* because of the column AE2.4 drops.
- `personScopeAllows` (`src/lib/users/person-scope.ts:143-144`) and its SQL twin
  `app.can_administer_person_for` already deny an empty footprint for **all four** capabilities,
  pinned explicitly against the vacuous-subset inversion. **Neither is the subject of this
  decision** — they say "no footprint ⇒ no `hospital_admin` claim", and that answer stands.

⛔ **Therefore doing nothing is not neutral.** Dropping the column without ruling makes an
offboarded person administrable by **nobody** — a silent narrowing whose blast radius is rehire:
if 0151 D12's optional deactivation was taken at offboarding, re-hiring needs `reactivateUser`
(capability `lifecycle`) → empty footprint → today org_admin-via-column → after the drop, no one.
Re-affiliation itself stays reachable; **reactivation and CPF correction do not.**

## Decision

**Last-org retention.** Administrative authority over a person with **no active affiliation** is
held by the administrators of the organization of that person's **most recent ended, non-voided
`organization_affiliations` row**, bounded to the **SUBSET** capabilities (`lifecycle`,
`cpf_change`) exactly as ADR 0133 Amendment 1 r1 bounds them today.

Bounds, stated so the implementation cannot widen by reading:

1. **Void is not end.** A `voided_at` row is "was never true" and is **excluded from the
   derivation entirely** — a person whose only org affiliation was voided has no retaining org and
   is `platform_admin`-only. This preserves the voided tense's whole point (ADR 0151).
2. **Most recent by `ended_on`; ties resolve to ALL tied organizations.** Two affiliations ending
   the same day yield two retaining orgs, not an arbitrary winner. ⚠ A tie-break that silently
   picks one would be a **narrowing** no test would notice, since the differential only pre-declares
   widenings.
3. **Retention is a read-and-SUBSET-write authority, not a membership.** It grants nothing beyond
   what an `org_admin` of an *active* affiliation would hold over the same person, and it never
   makes the person a member of anything.
4. **`hospital_admin` is unaffected.** An empty hospital footprint stays `org_admin`-only
   (ADR 0133 Amdt 1 r1, ADR 0151 D11). This ADR adds no hospital-tier reach.
5. **The rule is not `expires_at`-shaped.** No time decay, no window. See Consequences.

## Consequences

- ✅ **AE2 stays a mechanism change.** Behavior is preserved almost exactly, so AE2.3's widening
  differential should show near-zero movement — which is what makes "every widening is
  pre-declared or it is a red" an affordable rule rather than a rubber stamp.
- ✅ **ADR 0151 D5 survives untouched.** One-step rehire needs no org_admin ticket that it does not
  need today, because the retaining org is the same org that holds the person today.
- ⚠ **It partly collapses ADR 0148's asymmetry** (reads ever-held, writes active-only): an *ended*
  row now carries a **lifecycle write** authority. This is stated rather than glossed. The
  justification is that the authority is not new — it exists today via the column — and AE2's
  charter is to re-predicate it, not to revoke it. **Revoking it is a separate, later decision**
  and should be taken on its own evidence, not as a side effect of a column drop.
- ⛔ **Option (c), time-boxed decay, was rejected** for a specific reason: it introduces a
  permission that expires with **no event**, while `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` is open on
  exactly that question for the read half. Two unresolved expiry semantics in one model, and a
  differential cell whose expected value depends on `now()`.
- ⛔ **Option (b), platform-only, was rejected** as *premature*, not wrong. It is the tighter model
  and 0078 A35's noun rule admits it (identity is `platform_admin`'s noun). But it collides with
  0151 D5 unless reactivation is first decoupled from rehire — a second decision this phase has no
  warrant to take. **If that decoupling is ever ruled, (b) becomes reachable and this ADR should be
  revisited rather than worked around.**

## An inconsistency this decision does not create, and must not be read as blessing

`list_addable_commission_members` gates on `pr.home_organization_id = v_org_id and pr.is_active`
with **no affiliation filter of any kind** (`supabase/migrations/20260720000300_repoint_read_functions.sql:143-151`),
and `src/lib/queries/members.ts:243` still filters `.eq('home_organization_id', organizationId)` —
the exact predicate `listOrgUsers` was moved off in AFF4 B6a, whose regression test pins it only
**for that one function**. ⭐ One axis was swept; its sibling was not.

Both are AE2.1 census members and must be re-predicated in AE2.2. Their current behavior — an
offboarded person is *still listed as addable to a commission* — is **not** authorized by this ADR
and is a differential cell AE2.3 must carry explicitly, in whichever direction it moves.
