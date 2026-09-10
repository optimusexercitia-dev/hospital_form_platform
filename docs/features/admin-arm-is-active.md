---
id: ADMIN-ARM-IS-ACTIVE
title: "The admin arm follows the subject's state — `app.is_active` on `app.is_admin()`, `app.is_admin_for()` and `public.assume_role`, each RED-first; the `platform_admin` Class-2 write arm removed and relocated; R10's role-only audit stamp built with `315:212` rewritten; the four expected reds re-ruled, never silenced (pre-AE5 Batch 10 — the fix Batch 9 decided and deferred)"
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 10, the named consequence of Batch 9 (plan §6 holds no block for it by decision; scope derived from ADR 0201 + 0203 + the Batch 9 record's R11/R12 entries, never R3/R4 alone)"
branch: authz-admin-arm-is-active
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/admin-arm-is-active.md
reviews: []
adrs: ["0078", "0079", "0155", "0176", "0190", "0191", "0193", "0200", "0201", "0203"]
handoff: ~
fup: ~
---

# ADMIN-ARM-IS-ACTIVE — a deactivated `platform_admin` stops passing every admin arm in the tree

## Acceptance criteria

The unit closes **three** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause, quoted **there**, not paraphrased here. Nothing else counts as closure.

⚠ **This batch IS a migration**, by Batch 9's rulings (R3 + R12, R4, R10 — recorded in ADR 0201 D4/D5
and ADR 0203, and in `docs/progress/ae5-opening-adr.md`). The decisions are taken; ⛔ this unit takes
none of them again and re-opens none. What it owes is the **build**, each half with its own
RED-first cell, and the **re-rulings** that a changed predicate forces on tests that pinned the old
behaviour. ⇒ Batch 7's empty-pathspec assertion does **not** apply; the diff-scoped door sweep is
owed over **both arms** on the deriver's case list, and `public.assume_role`'s place on the hat-blind
allowlist must be **re-derived, not inherited** (Batch 9 record, gate table).

⚠ **A checked box means the CONDITION IS MET AND PROVEN, not that the register entry is closed.**
Entries stay `Status: open` until the Record step, after PO approval.

⛔ **Batch 7's lesson applies to all three clauses**: a `Closes when` can name stale heads, a wrong
predicate, or a case that cannot fail. Read each **body**, re-measure what it names from the **live
catalog** at the migration head pair recorded in the record (⛔ never migration text — ADR 0078), and
correct the clause *before* closing on it, never around it.

- [ ] `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE` 🟠 — `app.is_active` on
      **three** sites, not the two the clause names (R12 widened it to `public.assume_role`, the
      seating door: gating the two checks while leaving the seating ungated would *read* complete
      while a deactivated admin could still put the hat on). Owed, in order: (1) re-measure from
      `pg_proc` (comments stripped) that all three bodies lack the term; (2) the blast radius as
      **sets, not counts** — every policy `qual`/`with_check` and every `prosrc` naming each
      predicate (Batch 9 measured 26 policies + 13 functions for `is_admin()`, 0 + 5 for
      `is_admin_for`; a dated measurement to re-derive); (3) one migration, three sites, each with
      its own pgTAP cell **reported RED before the change** — the fixture shapes are named in the
      body: `145:414-425` single-principal, `328:477-490` **differential**, which the third site
      needs; (4) the clause itself rewritten to name three sites before it is closed on.
- [ ] `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-PLATFORM-ADMIN-CLASS-2-WRITE` 🟠 — ruled R4: the arm is
      **removed and relocated**, `app.can_manage_case_vocabulary` gaining an explicit `is_admin_for`
      arm on the **surviving** reason (ADR 0201 D5's refutation). The closure of 14 `public` RPCs
      (12 behaviourally affected) is re-derived from `pg_proc`; a cell proves `platform_admin` is
      denied `redact_professional_profile` (RED before / GREEN after) **plus** an assertion over the
      PostgREST path — the E2E variant was rewritten out at R6 (no reachable UI path).
- [ ] `FUP-AE5-OPENING-ADR-R10-AUDIT-STAMP-HAS-NO-REGISTER-HOME` 🟠 — `public.assume_role` writes its
      `active_role.assumed` row with **no** scope columns for **every** tier, verified live; ⛔ and
      pgTAP `315:212` is **REWRITTEN, not ticked** — under R10 the old assertion stays green while
      proving the wrong thing.
- [ ] **The expected reds re-ruled, never silenced** — `228:630-634` · `409` § 3.7 (*polarity **and**
      message*) · `415` § 1.2 · `229:215-220`, which **splits in two**. Each gets the PO's word on
      what it now asserts; a red that is simply flipped to green with its message untouched is the
      failure this box exists to catch.

**Gate.** `npm run lint` 0 errors / 0 warnings · `typecheck` · `npm run test` · `test:db` on a
fresh reset · the four authz arms with domains quoted · `SELFTEST=1` on the deriver **and** the door
harness · the set-valued targeted home · the diff-scoped deriver over `main...HEAD` with its
`SCOPE:` line quoted, its exit read **bare** before any substitution · the door sweep over **both
arms** on the derived cases · `git diff --name-only main... -- src` empty unless a ruling names a
TS mirror. ⛔ Someone other than the builder runs the arms at the tip.

## Current state

**Updated:** 2026-09-10

### Objective
Build what Batch 9 decided: the admin arm follows the subject's `is_active` state at all three
sites, the `platform_admin` Class-2 write arm is removed and relocated, and the role-only audit
stamp exists — each half proven by a cell that was RED first.

### Done since start
Unit opened on branch `authz-admin-arm-is-active` off `main` @ `b87eac1e`; preconditions measured
(clean tree, `origin/main..main` = 0, no `in_progress` hub); migration head pair at open
`(20261003007380, 527)`. The CLAUDE.md review queue on this clone processed first (12 entries; one
playbook paragraph, PO-approved) — dispositions in the record.

### In progress
`backend` planning from ADR 0201 + 0203, the R11/R12 entries and the three follow-up bodies —
reachability and blast radius as sets, the RED-first cells designed before any migration text.

### Next
The migration; the four re-rulings taken to the PO with the old and new assertion text side by
side; QA review; Record step.

### Blockers
None ruled. The four re-rulings need the PO once the builder has the replacement text.
