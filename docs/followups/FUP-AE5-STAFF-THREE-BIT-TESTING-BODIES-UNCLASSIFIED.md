# FUP-AE5-STAFF-THREE-BIT-TESTING-BODIES-UNCLASSIFIED

**Filed:** 2026-09-14 · unit `AE5-STAFF`, T7 condition C1 · owner **backend** · severity **medium**
**Register entry:** [follow-ups-open.md](follow-ups-open.md) · **Ruling:** lead L19

## What was measured

C1 wires row 9's designated authority, `app.can_reach_case_on_member_surface`, to the **four** sites
matrix § 8.3 names. Measured on the live catalog after that wiring, in a rolled-back transaction,
**seven** bodies test the bit through `app.has_case_capability(…, 'read_case_deliberation')` —
the four now wired, and three more:

- `app.can_read_full_case_content`
- `app.can_read_full_meeting_content`
- `app.is_oversight_only_reader`

(The other bodies that merely MENTION the string — `app._cap_bit`, `app._case_caps`,
`app.case_capabilities`, `app._grant_case_access_unchecked`, `app.trg_audit_case_access` — name it
as DATA or implement the capability machinery; they do not test it, and are not part of this item.)

## Why it is a follow-up and not a scope extension

⛔ Matrix § 8.3 is PO-approved and names four. Extending C1 to seven would be an implementer
widening an approved scope on a reading — lead ruling L19 refused it, and the three may legitimately
be **composers**: functions that build a capability answer for some other surface rather than asking
row 9's member-facing question. The authority's own comment draws exactly that distinction
(*"Use this on member-facing case-reach surfaces"*), so composer-vs-surface is the classification
that decides each one.

⚠ THE CONSEQUENCE FOR THE GATE RECORD, STATED SO IT IS NOT OVERCLAIMED: after C1 the true sentence
is **"4 of 7 bit-testing bodies wired; 3 named, out of scope"**. The stronger sentence — *"after
this no body tests the bit inline"* — is FALSE and must not be written.

## How to close it

For each of the three, measure what it is called from and what it decides:
- if it **composes** the capability for another predicate's answer, document that in its own comment
  and record it here as classified — no wiring;
- if it **asks row 9's question on a member-facing surface**, wire it to the authority exactly as
  C1's four are, and move the census from 4 to the new number at both grains (sites and call sites).

⛔ Closing this by deleting the three from the count, or by re-scoping § 8.3 without the PO, is
not a close.
