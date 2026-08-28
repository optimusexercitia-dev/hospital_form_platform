# 0165 — the affiliation-derived tenant gate, what it widens, and the alternative rejected for now

**Status:** Accepted · 2026-08-28
**Amends:** 0151 (D11's and D13's tenant check — *"a person may only be affiliated inside the
organisation they are anchored to"*, evaluated against `profiles.home_organization_id` — is
re-expressed against `organization_affiliations`. The SQLSTATE, the message and the
not-found/wrong-org conflation are preserved; the admitted set is not.)

## Context

ADR 0164 ruled that tenant containment moves to the destructive event, and that
`app.affiliate_person_to_org_impl`'s column gate must go in the same migration, because neither
half can move first. **It did not say what the gate becomes** — that was left as implementation,
and it is not mechanical: the obvious re-expression is wrong.

Three states must be admitted and one must not:

- **person creation** — the profile exists before any affiliation does, so the door is how the
  *first* affiliation is made. A gate requiring an existing affiliation is the circularity again.
- **one-step rehire** (ADR 0151 D5) — an ENDED, non-voided row in the target org.
- **the idempotent path** — a person already active in this org, who may also be active elsewhere.
- **not**: a person whose non-voided tenancy is entirely in another organisation.

⛔ **The obvious predicate — "no non-voided affiliation OUTSIDE `p_organization`" — fails the third.**
It refuses every person active in two organisations, including on the door's own early-return
idempotent path, which is a NARROWING of a live capability. Measured as cell W8 in pgTAP `393 § 3`.

## Decision

**D1 — the gate is "known here, or known nowhere".** The door raises `HC0R0` iff the person has
≥ 1 non-voided organization affiliation **and none of them is in the target organisation**.
"Known here" deliberately includes **ended** rows and deliberately excludes **voided** ones —
ADR 0163 bound 1, void is not end.

**D2 — the existence check is explicit and stays conflated.** `select … into` + `if not found then`
raises the *same* `HC0R0` with the *same* pt-BR message as a wrong-organisation refusal. The old
gate got this for free (the column is NULL for a person who does not exist); the new one must do it
deliberately, or the door becomes a cross-tenant existence oracle over `profiles.id`.

**D3 — both siblings move in the same migration.** `app.affiliate_person_impl` (hospital tier)
carried a gate that was **byte-identical apart from how the organisation is obtained**
(`v_org := app.org_of_hospital(p_hospital)` vs `p_organization`) — lifted from the catalog and
diffed, not assumed. Same question, same answer. `393 § 5.7` re-derives that identity from `pg_proc`
every run, so a fix applied to one sibling and not the other reds instead of shipping. ⚠ This
reverses the increment's original scope, which had the hospital door in a later slice; the reason is
that "one axis was swept, its sibling was not" has already happened three times in this phase.

## Consequences

- ⚠ **THE WIDENING, pre-declared: three states the column gate refused are now admitted** —
  column names another org but there is NO affiliation row; the only row is VOIDED; a true orphan
  (column NULL). In all three the person has no non-voided tenancy anywhere, and **after the column
  drops there is no fact that anchors them to anyone**, so refusing every organisation makes them
  permanently unreachable. It is also the only recovery path for the creation-time window ADR 0164
  accepts. Measured cell by cell: `393 § 3` (org tier, W5/W6/W7) and `393 § 5` (hospital tier, H4).
- ⚠ **The hospital tier makes it materially wider**: that door's authority arm is
  `org_admin OR hospital_admin`, so a **hospital admin** can claim an orphan too. Stated rather than
  buried inside "the same predicate".
- ✅ **The reachability bound is MEASURED, not asserted.** No non-`platform_admin` caller can
  *enumerate* such a person: `list_org_people` gates on `organization_affiliations … voided_at is
  null` on **both** legs (`p_include_ended` relaxes only `ended_on`, and the CPF branch carries the
  same `exists`), `list_addable_commission_members` is strictly narrower, every TS roster derives its
  id set from those, and no `profiles` SELECT policy leg admits an affiliation-less person to a
  non-platform caller. `393 § 1.8/§ 1.9` re-measure the two roster paths **with positive controls**,
  because a zero from a door that returns nothing would prove the opposite of what it reads.
  ⛔ Two paths resolve an orphan **by identifier** and are unchanged by this decision:
  `resolveOrInviteUser` (`src/lib/members/invite.ts:51`) turns an **email** into an id with no
  affiliation predicate and auto-grants `staff_admin`, and it still gates on
  `home_organization_id` — so it is an unlisted consumer that the column drop must handle.
  `listLinkableOrgUsers` (`src/lib/queries/members.ts:235`) is a 500-row `profiles` listing keyed on
  the column and held closed by `profiles` RLS **alone**; increment 4 must not repair it by adding
  an anchor-org leg to a `profiles` policy, or the enumeration surface opens in the same commit.
- ⚠ **The transition asymmetry, said plainly:** until the column actually drops, the first widened
  state — column says B, no affiliation rows — is one where **a fact still exists and the new gate
  ignores it**. Local to this branch and bounded by it, but it is the honest description, not
  "behaviour is preserved".
- ⛔ **The alternative REJECTED FOR NOW, recorded so a later tightening is a decision and not a
  discovery:** keep the gate strict (admit only "known here") and give orphan recovery **its own
  audited door** — `platform_admin`-only, emitting its own audit verb, so claiming an anchorless
  person is an act of record rather than a side effect of an ordinary affiliation. It is the cleaner
  model and it removes the hospital-tier widening entirely. It is out of scope here because it adds
  a door, a capability and an audit verb to an increment whose charter is to break a circular
  dependency, and because it would leave person **creation** with no admissible path until that door
  exists. ⚠ If it is ever taken, this ADR's D1 becomes "known here" alone and `393`'s W5/W6/W7 and
  H4 flip from widening to refusal — the cells are already there to flip.
- ⭐ **A measured correction to ADR 0159's predicted failure mode, for this trigger.** 0159 says an
  INVOKER invariant backstop raises a **false positive**. Here the first draft failed the *other*
  way. Profile visibility is itself affiliation-derived since AE2.2, so a caller blind to the
  affiliations is blind to the subject's `profiles` row as well — **the two blindnesses are
  correlated** — and the draft's `if not found then return null` turned that into a **silent
  accept**, orphaning the person: a fail-OPEN, strictly worse than a refusal and invisible to an
  accept cell. `393 § 2.5` was green under `security invoker` until the trigger was made
  **fail-closed** (an unresolvable subject is treated as non-admin and refused). Found by mutation,
  not by reading. The general form: *an escape hatch for the UNMEASURABLE also silences the
  MEASURED*, and a guard that reads right can fail open.
- ⛔ **Owed, not fixed here:** voiding a person's last non-voided affiliation now raises a raw
  `23514` from the containment trigger, and unlike its hospital-tier precedent (ADR 0156) that raise
  **is** reachable by a user action, so it can surface unmapped. Giving `void_org_affiliation` its
  own mapped `HC0R*` refusal is a separate change with its own `toState` mapping.
