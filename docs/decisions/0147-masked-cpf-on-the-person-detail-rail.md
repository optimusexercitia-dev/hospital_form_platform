# 0147 — Masked CPF on the person detail rail

**Status:** Accepted · 2026-08-25
**Supersedes:** nothing. **Amends:** 0133 (D12).

## Context

ADR 0133 D12 made the CPF **presence-only** on the administrative person surface: the
rail received a `cpfPresent` boolean and no digits, "masked or otherwise". The reasoning
was minimum-necessary — an administrator editing someone's record does not need to read
their national identity key.

In use it does not hold. Brazil's homonym rate is the whole reason D11 already admits
`date_of_birth` into the org people directory as the practical human differentiator, and
the person detail page is where an administrator lands *after* that lookup. A boolean
cannot answer either question actually being asked there: **is this the same person I just
searched for**, and **am I about to edit the right record**. Two same-named people in one
org network reduce to two identical rails.

## Decision

1. **A masked CPF is admitted to the person detail rail.** `PersonPersonalData` gains
   `cpfMasked: string | null` — `AAABBBCCCDD` renders `AAA.•••.•CC-DD`: digits 1–3 shown,
   digits 4–7 hidden, digits 8–11 shown. `null` means nothing stored, or a stored value
   that is not 11 digits after punctuation is stripped.
2. **Masking is computed server-side**, inside `getPersonAdminView`, beside the only
   authorized read of `profiles.cpf`. The masker is not exported: an exported one invites
   a call site that must hold the raw value first, which is the boundary crossing this
   ADR does not reopen.
3. **The raw key still never crosses the wire.** D12's load-bearing half is unchanged —
   digits 4–7 and the full 11-digit value leave the server under no branch, and the rail
   still has no path to them.
4. **`cpfPresent` is KEPT, not replaced.** `cpfMasked` is `null` for both "nothing stored"
   and "stored value malformed", so it cannot answer "is there a CPF on file"; presence
   remains the fact the edit form and any completeness check need.

## Consequences

- The rail can differentiate people and confirm identity without a second lookup.
- **Residual, stated plainly:** the mask exposes **7 of 11 digits** to a caller who already
  holds the ADR 0133 `fields` capability. Minimum-necessary is preserved in the sense that
  matters here — the wire never carries the full key, so no client, log, or cache can
  reconstruct it — but this is genuinely more than a boolean, and it is a deliberate trade
  against an unusable surface, not an oversight.
- The check digits (10–11) are shown. They are derived from the first nine and so add no
  independent information; the four withheld digits are what make the key unreconstructable.
- `person-admin-view.test.ts` §3 previously pinned the *stricter* rule and asserted that not
  even a three-digit fragment could appear. It now pins this one: the mask's exact shape,
  and that digits 4–7 never appear in any form. A future reader must not "restore" the
  earlier assertion — it was decided against, not overlooked.
