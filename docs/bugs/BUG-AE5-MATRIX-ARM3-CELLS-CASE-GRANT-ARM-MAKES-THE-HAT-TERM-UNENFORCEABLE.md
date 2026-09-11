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

## Related

Unit [AE5-MATRIX-ARM3-CELLS](../progress/ae5-matrix-arm3-cells.md) · ADR 0175 D3 · the open QA
finding F3 at `docs/reviews/authz-ae4-review.md:93-101` · `403_ae45_differential_oracle.sql:612-618`
(§7.3, whose `0` sentinel this unit breaks by design).
