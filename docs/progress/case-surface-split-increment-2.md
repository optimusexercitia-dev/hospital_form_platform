# Case surface split — Increment 2 (ADR 0134)

_Opened 2026-08-22 as the rotation destination for Increment-2 material while the increment is still
IN BUILD. Live status stays in [PROGRESS.md](../../PROGRESS.md) § Now; this file takes rulings whose
**binding work has landed**, so § Now carries what is still actionable rather than a record of what
was decided. It becomes the completed record at the §6 step-5 Record._

⛔ **Nothing here is a completion claim.** Increment 2 is **not merged**; every follow-up these bullets
name keeps its own index line in § Follow-ups and stays OPEN until it is.

## Rulings whose implementation has landed

### ADR 0134 Amendment 4 — rotated 2026-08-22

Rotated because the bullet's own words were *"binds M2 before it is written"* and **M2 is written**:
the `not v_eg` bound is applied, and P9 / P9-twin / P10 / P11 are green with the twin
mutation-proven — removing the bound reddens the locked-case pins **and** the bit-shape pins, which is
Amendment 4 §A4.2's derivation becoming evidence in the direction it predicted. The door-set
enumeration it demanded is done **and pinned in `356` §13** rather than merely recorded: 4 direct
routines, 0 direct policies, and — the number the "4 routines" framing hides — **11 RLS policies + 3
routines transitively**, through its negation `app.can_read_case_committee`, which is keyed on **bits,
not arms**. ⚠ `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY` **stays OPEN** until this branch merges.

- **✅ RULED 2026-08-22 — ADR 0134 Amendment 4: S8 is bounded by `not v_eg`, like its siblings.** An
  `explicit_grants_only` case is invisible to the `read_cases` arm; reach there rides an explicit grant
  (S3) or nothing, exactly as for S5/S7. ⛔ Ruled **separately** from Amdt 3 and does not inherit its scope.
  Unbounded, a capability checkbox would have **outranked a per-case access policy**, and left the appointee
  `read_case_content ∧ ¬read_case_deliberation` — **the quality reviewer's exact bit-shape** — so every door
  keyed on `is_oversight_only_reader` would misread an administrativo as a reviewer.
  **Binds M2 before it is written:** the `not v_eg` condition · **P9** locked-case negative · **P9-twin**
  (remove the bound ⇒ P9 RED — an omitted sibling check is invisible to every ARM) · **P10** bit-shape both
  directions (Amdt 4's claim is *derived, not executed*) · **P11** the S3 grant path still works · and the
  `is_oversight_only_reader` **door set enumerated by `prosrc` property** — ⚠ its size is **not established**
  (one member found while measuring something else). `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY` stays **OPEN**
  on that implementation residue: ruled ≠ discharged.

### ADR 0134 Amendment 6 — rotated 2026-08-22

Rotated because its binding work has landed: `app.member_can_for` is the single implementation,
`app.member_can` delegates, and the S8 arm calls the resolver-safe form. ⛔ **Two corrections to the
bullet below, both made after it was written** — (a) the predicate it calls a **four-conjunct** one has
**three independent terms**: `is_member_of_for` already contains `is_active`, so deleting the explicit
term alone leaves the S8 suite 71/71 green, and *a sweep asserting `is_active` is PRESENT would pass on a
body where it had been deleted*; (b) its inlining mechanism was **inferred and stated as measured** — a
four-arm probe with a flipping control shows `SET search_path` **alone** also blocks inlining, and
`member_can` carries both, so `prosecdef` is *a* sufficient blocker and not demonstrably the operative
one. The conclusion (no hoist was being lost) survives both.

  - **⛔ RULED 2026-08-22 — ADR 0134 Amendment 6 (lead, PO may overrule): D6 names a chokepoint that
    cannot answer S8's question.** `app.member_can` takes **no uid** and is `auth.uid()`-bound, while
    `app._case_caps` is a **`(case, uid)`** resolver — and it is the only membership helper in `app` with
    no `_for` twin. Used as written, S8 would answer **about the caller** at all **14** measured cross-uid
    `can_read_case` call sites, and would re-open Amdt 4's bit-shape collision through a door **no ARM can
    see** (a uid-source mismatch is not a missing gate). Ruling: `member_can_for` becomes the **single**
    implementation and `member_can` **delegates** — one body, rather than two hand-copies of a predicate
    whose first conjunct is the kill switch. The cost objection (lost inlining) was checked and **did not
    survive**: `member_can` is `SECURITY DEFINER`, which Postgres never inlines. ⚠ The plan **and** the ADR
    both named this mechanism and both were wrong for four amendments — caught by reading the signature.

### Pre-work measurement — rotated 2026-08-22

Rotated because its output is now carried where it belongs: the five corrected baseline rows are
**in ADR 0134 itself**, each marked as a correction rather than silently rewritten, and Amendment 5 is
its own ADR section. What remained here was a summary of records that already exist.

  - **✅ Pre-work measured 2026-08-22 (V-D · V-E/V-F/V-G · the Amdt-2 M1–M13 baseline), and it moved
    five records.** ADR 0134's baseline rows are corrected **in place** with the correction marked, not
    silently: **M13** the keystone is `:162-168`, `:153` is the fixture INSERT (cited wrong in 3 files
    since filing) · **M10** the PHI-loss-on-refusal shape has **TWO** sites (`createCase` :570-577 as
    well), so a one-site fix would have read as done · **M11** the `CasePatientPanel` mount is `:866-871`,
    the cited `:822` is a different component · **M2** `read_standard_phi` has **3 writes in 2 arms**, not
    "exactly two sources" · **M4** the xref "gate" is **three different gates** (`get_patient_trajectory_for_entity`
    is PQS-only, no DPO arm). ⭐ **RULED 2026-08-22 — ADR 0134 Amendment 5:** D6's *"default-checked"* is a
    **grant**, not a pre-ticked box — the dialog has no defaults (checkboxes render server state), so
    `appoint_administrativo` grants `read_cases`; the client-side-tick reading is **rejected outright** as a
    mirror wider than its door. Does **not** reopen OPEN-1 (that governs existing appointees).

### The three unanticipated findings — rotated 2026-08-22, all three DISCHARGED

Rotated because each has an outcome, and the outcome is not the same for all three:

1. **The false PHI copy — FIXED.** The appoint dialog no longer claims `create_cases` lets someone
   *"inserir **e visualizar** dados de paciente"*. New copy states entry-at-creation-only and no
   reading ever, and it landed **in the same delivery as the door that made half of it true**. Verified
   on **rendered output**, never by a source grep — the comment explaining the fix would itself be a hit.
2. **The A2.2 mechanism gap — RESOLVED, and it was the smaller half of a larger one.** Splitting only
   `set_participant_patient` would have left bulk coordinator-gated, because bulk calls the compat door.
   ⭐ Fixing it then exposed the real problem: **bulk is a COMPOSITION**, which is ADR 0134
   **Amendment 7**.
3. **The `is_oversight_only_reader` door set — ENUMERATED *and pinned*** in `356` §13, not merely
   recorded: 4 direct routines, **0 direct policies**, and — the number the "4 routines" framing hides —
   **11 RLS policies + 3 routines transitively** through its negation `app.can_read_case_committee`,
   which is keyed on **bits, not arms**. ⛔ Nothing in it was changed (Amdt 4 §A4.4: findings first).

  - **🆕 Three findings the plan did not anticipate, each owned inside this increment.** ⛔ **A live UI
    string over-claims PHI**: the appoint dialog tells the coordinator `create_cases` lets the person
    *"inserir **e visualizar** dados de paciente"* — the *visualizar* half is **measurably false today and
    stays false under option D**, and an E2E assertion pins the false text. ⛔ **The A2.2 split writer as
    specified does not reach bulk**: `bulk_create_cases` calls `set_case_patient`, not
    `set_participant_patient`, so splitting only the latter leaves bulk coordinator-gated — the mechanism
    must cover the compat door too. ⚠ **The Amdt-4 §A4.3-item-6 door set is bigger than "4 routines"**: its
    consumer `app.can_read_case_committee` **is its negation** and is keyed on **bits, not arms**, reaching
    ~11 RLS policies + 3 routines — so a content-without-deliberation arm would join that extension
    silently. Recorded as findings; **nothing there is changed** (Amdt 4 §A4.4).

## BUG-ADM-APPOINT-CAPS-NOT-SYNCED — filed 2026-08-22 by the tester

`toggleAppointment()` in `src/components/members/member-administrativo-controls.tsx` calls
`setAppointed(true)` on a successful appoint but **never syncs the client `caps` state**, so Amendment
5's auto-granted `read_cases` renders **unchecked** in the live dialog. Reproduced 3× against a freshly
rebuilt server.

⛔ **The database is correct** — the `commission_administrativo_capabilities` row lands the instant
`appoint_administrativo` returns, verified directly, and a page reload shows the box checked. This is a
UI state-sync miss, **not** an authorization defect, and it must not be reported as one.

⭐ **Why it is worth more than a normal state-sync miss.** Amendment 5's whole ruling is that the box is
checked *because the grant exists*. A coordinator appointing someone sees the opposite of what the
database says — and the obvious fix a later reader reaches for is to **pre-check it client-side**, which
is the mirror-wider-than-its-door defect this branch closed **twice** (`canInCommission`, and the
rejected third reading of Amendment 5 itself). The fix must sync **from the server**, never assume "we
appointed, therefore they hold `read_cases`" — that hard-codes today's auto-grant into the UI and
becomes a lie the day the grant changes.

⚠ **B5's second assertion has never executed.** The spec throws at the first assertion, so
*"unchecking `read_cases` empties the board again"* has never run. When the fix lands, that half runs for
the **first time** — B5 going green must not be read as re-confirming behaviour that was previously
passing.

**Found only because the tester ruled out a stale instrument first** — see the dev-server staleness
finding; the same session nearly filed a bulk-gate failure as a product bug when it was the server
serving three-commits-old code.

