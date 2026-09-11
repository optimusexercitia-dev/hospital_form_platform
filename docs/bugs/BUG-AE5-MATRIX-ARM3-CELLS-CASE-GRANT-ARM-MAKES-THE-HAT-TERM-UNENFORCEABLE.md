---
id: BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE
status: fixed
severity: high
area: authz
opened: 2026-09-10
closed: 2026-09-11
feature: AE5-MATRIX-ARM3-CELLS
related_adrs: [0175, 0176, 0201, 0209]
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

## ⭐ PO ruling on the fix shape and its second duty (2026-09-11)

**Ratified as a PO ruling, not only the unit's measurement:** the fix may add **neither an org check
nor a role-keyed hat check inside arm 3** — `403` **§7.5** reds on the first (class 4, cross-org
reach) and **§4.1b** on the second (class 3, the role-free S3 reach) — so whoever fixes this must
handle S3's role-free case explicitly, most likely by evaluating the hat term **before** the arms
(R2's second shape). ⛔ A fix is not done while either section is red, and §7.4 must go red-to-green.

**Second duty of the same migration:** it is the **confirmed carrier** for
`FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION` — when it re-emits
`app.can_read_professional_profile`, the arm-3 comment's parenthetical *"exercised-but-not-oracled
(ADR 0175 D3 / 403 §7.3)"* must be corrected in the same body (the follow-up body has the wording).
⛔ Never a separate comment-only migration.

## Related

Unit [AE5-MATRIX-ARM3-CELLS](../progress/ae5-matrix-arm3-cells.md) · ADR 0175 D3 · the open QA
finding F3 at `docs/reviews/authz-ae4-review.md:93-101` (now carrying this bug's pointer).

**Where this bug is PINNED, by section name — ⛔ never by line anchor.** `403` **§7.4** asserts the
defect head-on and **§7.5** is the class-4 guard on its fix; **§4.1b** is the oracle the carve-out is
taken out of. ⚠ The anchor this line previously carried — `403_ae45_differential_oracle.sql:612-618`,
the old `= 0` sentinel — was stale **the day it was written**: the same unit replaced §7.3 by ~400
lines, and that range now lands inside §4.1b's prose. ⇒ sections are named, not numbered by line.

## ✅ FIXED — 2026-09-11 (unit `ARM3-HAT-TERM-FIX`, migration `20261003007400`, ADR 0209)

The door evaluates the ACT hat **before** the arms (R2's second shape): at a self-check, a caller who
holds at least one live role and whose `app.active_role()` is none of them is denied whatever arm would
have answered; a role-less caller keeps the case-grant reach (class 3, 36 cells — §4.1b green); no org
term was added (class 4 at the matching hat — §7.5 green). `403` §7.4 was **deleted** by the route its
own message named and §7.4b pins the term head-on in both polarities plus the hatless-holder value.
⚠ The door denies **18** grant-keyed cells, not this bug's 10: the extra **8** are `other_role`
self-checks at a cross-org coordinate that class 4 held by generator precedence — re-ruled DENY as
ADR 0209 D5, **ratified by the PO 2026-09-11**. Mutation table, gate readings and the QA rounds:
[docs/progress/arm3-hat-term-fix.md](../progress/arm3-hat-term-fix.md).

## Root cause

The ACT hat rule lived only as the trailing conjunct of the role-keyed predicates (`app.has_role`,
`app.has_role_any`, `authz.holds_role`, `app.is_admin_for`): *"p_user_id is distinct from auth.uid()
or p_role is not distinct from app.active_role()"*. Arm 3 of `app.can_read_professional_profile`
grants through `app._case_caps` sources S3 (`case_access_grants`) and S4 (case assignment), which are
keyed on `principal_id` alone and call none of those predicates — so no hat term was ever evaluated on
that path. Measured comment-stripped from `pg_proc` at head pair `(20261003007390, 528)`: `active_role`
and `auth.uid` ABSENT from the door, `_case_caps`, `can_read_case`, `can_read_case_committee` and
`can_manage_professional`, PRESENT in the two controls `has_role` / `is_admin_for`. A rule enforced by
every arm but one is a rule the door does not enforce.

## Regression protection

- `supabase/tests/403_ae45_differential_oracle.sql` **§7.4b** — a live four-line pin on the door: the
  fix's DENY (holder self-check at `quality_reviewer`), the GRANT it must not break (`f.nobody` at the
  same hat and reach), the hatless-holder value (NULL hat ⇒ deny), and a role-holding third-party caller
  (unchanged GRANT). Each line's failure mode is named in its message.
- `403` **§7.3** — the `grant_keyed` partition string re-derived, with the 18 cells under
  `arm3:pre-empted:door-hat-term`; **§4.1/§4.1b** now compare those cells BY VALUE (carve-out dropped);
  **§7.5** stays the org-check guard.
- Generator `scripts/gen-authz-differential-cells.py` arm10(b), re-keyed on the
  `arm3:divergent-defective:` family with a synthesised `--self-test` cell (gate 12).
- `ARM=hat` (`act-hat-blind-sweep.sh`): the door carries its hat evidence in the same chunk as its
  caller-bound `memberships` read and is not allowlisted — it passes on merit.
- Mutation witnesses (record § Session log, build entry): an org check inside arm 3 reds §7.5; a
  hat-alone check reds §4.1b on 36 cells; reverting the relabel reds §4.1b on 8 and §7.3.
