---
id: BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE
status: open
severity: high
area: authz
opened: 2026-09-10
closed: null
feature: AE5-MATRIX-ARM3-CELLS
related_adrs: [0175, 0176, 0201]
---

# Arm 3's case-grant reach makes the active-hat rule unenforceable

## The defect, in the PO's terms (ruling R2)

The hat term inside `app.has_role` / `has_role_any` / `holds_role` — `… or <role> is not distinct
from app.active_role()` — exists to say **"you cannot read your own profile while acting as another
role."** `app.can_read_professional_profile`'s **arm 3** reaches through `app._case_caps` sources
**S3 (`case_access_grants`) and S4 (case assignment)**, and ⛔ **neither contains a role lookup at
all**. So arm 3 grants under **any** `active_role`, including an **absent** one, and the rule above
becomes **unenforceable for anyone holding a case grant**.

⛔ **This is a rule rendered inoperative, not a generic fail-open**, and the distinction is the
PO's: the lead first framed it as *"an absent hat fails closed everywhere else"*, which is a wider
and weaker claim. The narrow framing is what governs the fix and its test.

## Measured, live, on the untouched seed

Head pair `(20261003007390, 528)` on a fresh `npx supabase db reset --local`. Reproduced by the lead
in a rolled-back transaction with `request.jwt.claims` set so both `auth.uid()` and
`app.active_role()` bind (⛔ not `test_helpers.claims_for`, which is pgTAP-harness-only). Subject
profile `fb000000-0000-0000-0000-0000000000e1` (org `0c000000-…-0000000a`); caller
`chefe.ccih@test.local` (`00000000-…-00000002`); reach is **S3** on `explicit_grants_only` case
`ca000000-…-e1`, where chefe holds one live `case_access_grants` row.

| hat | whole_fn | arm1 | arm2a | arm2b | arm3 |
|---|---|---|---|---|---|
| `staff_admin` | t | f | f | **t** | t |
| `staff` | **t** | f | f | f | **t** |
| *absent* | **t** | f | f | f | **t** |

At `staff_admin` arm 2b **masks** arm 3 — a differential written at that coordinate passes with arm 3
broken, which is exactly the *"OPEN AND MASKING"* hazard the enforcement manifest records. At hat
`staff` and at **no hat at all**, three arms deny and **arm 3 alone answers `true`**. Caps drop
111 → 6 between those hats while arm 3 stays true, which is what identifies the reach as S3 rather
than the role-keyed S1.

## Scope

Class 5 of the derived partition of the `org.professionals.read` differential population: **10** of
216 cells — `principal_state ∈ {active, pending}` ∧ `self_check` ∧ `active_context = 'other_role'` ∧
a holder persona. (The partition is `108 + 30 + 36 + 32 + 10 = 216`; classes 3 and 4 are **approved
designed reach**, not defects.)

⚠ Related, **not** part of this bug and **not** a defect: `app.is_active` reads only
`profiles.is_active` and `suspended_until`, so `pending` is not an inactive state and arm 3 stays
reachable on all 54 `pending` cells. `_case_caps` STEP 2 **does** close arm 3 for `suspended` and
`deactivated`.

## The fix — either shape is acceptable (R2)

1. Make the case-grant arm respect the active-hat check; **or**
2. Have the door evaluate the hat term **before** the arms, rather than inside some of them.

## ⛔⛔ BINDING CAVEAT ON THE FIX AND ITS TEST (PO, R2)

Classes 4 and 5 **overlap conceptually**. Class 3 (36 cells, an unprivileged caller reaching through
an explicit case grant) and class 4 (32 cells, cross-org) are **APPROVED**: the case-grant path
deliberately anchors on the **case**, not on the caller's org or role — *"that is the whole point of
an explicit grant"* — and narrowing it *"would silently break cross-org case collaboration that the
referral module exists for."*

⇒ **a fix that adds a hat check inside arm 3 MUST NOT accidentally add an ORG check**, and
⛔ **the pgTAP guard for this fix MUST assert that one class-4 cell STILL GRANTS.** A fix verified
only by class 5 going red-to-green would silently revoke an approved reach, and no arm in any suite
would say so.

## ⭐ The guard now EXISTS, and mutation testing extends the caveat (2026-09-10, increment 3)

`403` was taught to oracle arm 3 before this bug is fixed, so the constraints above are **assertions
in the tree**, not instructions in a document:

- **§7.4** pins this defect head-on — *"this is what it does, and it is wrong"*: the 10 cells are the
  only cells carved out of §4.1/§4.1b **by label**, and §7.4 asserts the carve-out's exact shape
  (10 cells · legacy grants on 10 · all `grant_keyed` · all `other_role` · all `self_check` · the
  **approved answer denies on 10**). ⛔ The approved value stays **DENY**, so the defect is never
  encoded as approved reach and the carve-out cannot widen quietly.
- **§7.5** is the class-4 guard the PO's caveat demanded, asserting **both directions** of the
  cross-org edge at `grant_keyed` under the matching hat.

**Mutation-proven, on scratch copies with the real `403` untouched** (green-on-first-run was treated
as a finding, not a pass):

| mutant | result |
|---|---|
| **A** — an **org** check added inside arm 3 | §4.1b · §7.3b · §7.4 · **§7.5 RED** — the caveat's failure mode is caught |
| **B** — the `case_access_grants` row removed | the same four RED |
| **C** — a **hat** check added inside arm 3 (*the intended fix*) | §7.4 RED, **§7.5 GREEN** — the fix fixes this bug **without** breaking class 4 |

⇒ mutant C is the PO's caveat demonstrated: the intended fix moves §7.4 and leaves §7.5 standing.

⚠⚠ **AND MUTANT C EXTENDS THE CAVEAT — read this before attempting the fix.** Mutant C also reds
**§4.1b**, and it is **correct to**: a **role-keyed** hat check kills **class 3's** approved reach too
(36 cells — the unprivileged caller reaching through an explicit case grant), because **S3 is
role-free by design**. ⇒ the binding constraint is **wider than the PO's original wording**: a fix
must add neither an **org** check (class 4 breaks) **nor a naive role-keyed hat check** (class 3
breaks). Whoever fixes this must handle **S3's role-free case** explicitly — most likely by
evaluating the hat term **before** the arms, which is the second of the two shapes R2 named, rather
than inside the case-grant arm, which is the first.

## Related

Unit [AE5-MATRIX-ARM3-CELLS](../progress/ae5-matrix-arm3-cells.md) · ADR 0175 D3 · the open QA
finding F3 at `docs/reviews/authz-ae4-review.md:93-101` (now carrying this bug's pointer).

**Where this bug is PINNED, by section name — ⛔ never by line anchor.** `403` **§7.4** asserts the
defect head-on and **§7.5** is the class-4 guard on its fix; **§4.1b** is the oracle the carve-out is
taken out of. ⚠ The anchor this line previously carried — `403_ae45_differential_oracle.sql:612-618`,
the old `= 0` sentinel — was stale **the day it was written**: the same unit replaced §7.3 by ~400
lines, and that range now lands inside §4.1b's prose. ⇒ sections are named, not numbered by line.
