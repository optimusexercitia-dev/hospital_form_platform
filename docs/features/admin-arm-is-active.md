---
id: ADMIN-ARM-IS-ACTIVE
title: "The admin arm follows the subject's state — `app.is_active` on `app.is_admin()`, `app.is_admin_for()` and `public.assume_role`, each RED-first; the `platform_admin` Class-2 write arm removed and relocated; R10's role-only audit stamp built with `315:212` rewritten; the four expected reds re-ruled, never silenced (pre-AE5 Batch 10 — the fix Batch 9 decided and deferred)"
status: complete
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 10, the named consequence of Batch 9 (plan §6 holds no block for it by decision; scope derived from ADR 0201 + 0203 + the Batch 9 record's R11/R12 entries, never R3/R4 alone)"
branch: ~   # ff-merged to main 2026-09-10 at the Record step; branch deleted. The merge state's ONE home is docs/plans/pre-ae5-remediation.md §2 -- this comment asserts nothing about it
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/admin-arm-is-active.md
reviews: ["../reviews/admin-arm-is-active-review.md"]
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

- [x] `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE` 🟠 — ✅ **ticked AT the Record
      step (2026-09-10, after PO approval)**, closed on the clause's "fix" arm over THREE sites: live
      `prosrc` of both predicates carries `app.is_active(` (QA re-derived), `assume_role` door-wide by R1;
      `418` 13 of 30 RED at `(20261003007380, 527)`, 30/30 after (migration `20261003007390`); the third
      site proven noticed by targeted CASE 2a. Owed at open: `app.is_active` on
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
- [x] `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-PLATFORM-ADMIN-CLASS-2-WRITE` 🟠 — ✅ **ticked at the
      Record step**, closed on the "removed" arm: arm gone from `can_manage_professional`, relocated
      into `can_manage_case_vocabulary`, `can_manage_external_participant` NOT armed (option (b)
      rejected, R4); `418 §4` RED before / GREEN after; the PostgREST-path assertion = ACL + `prosecdef`
      + the door's 42501 + no table privilege — ⚠ the HTTP hop itself stays UNPROVEN by pgTAP (stated in
      the archive closure). Owed at open — ruled R4: the arm is
      **removed and relocated**, `app.can_manage_case_vocabulary` gaining an explicit `is_admin_for`
      arm on the **surviving** reason (ADR 0201 D5's refutation). The closure of 14 `public` RPCs
      (12 behaviourally affected) is re-derived from `pg_proc`; a cell proves `platform_admin` is
      denied `redact_professional_profile` (RED before / GREEN after) **plus** an assertion over the
      PostgREST path — the E2E variant was rewritten out at R6 (no reachable UI path).
- [x] `FUP-AE5-OPENING-ADR-R10-AUDIT-STAMP-HAS-NO-REGISTER-HOME` 🟠 — ✅ **ticked at the Record step**:
      NULL scope triple every tier verified live (QA §7), `315:212` REWRITTEN (`3b54bf11`), `:246-249`'s
      dead reason rewritten; targeted CASES 2b/3 prove `315` notices the stamp moving or vanishing.
      ⚠ The stamp's two READERS moved and were ruled at the E2E gate (R6: seating is an identity event;
      ADR 0201 D2 amended). Owed at open: `public.assume_role` writes its
      `active_role.assumed` row with **no** scope columns for **every** tier, verified live; ⛔ and
      pgTAP `315:212` is **REWRITTEN, not ticked** — under R10 the old assertion stays green while
      proving the wrong thing.
- [x] **The expected reds re-ruled, never silenced** — ✅ **ticked at the Record step** (`3b54bf11`
      + R4's `a74f2409`; deviations R5; every message states what it now proves — QA §4). ⚠ **reworded 2026-09-10 (PO ruling R2)**: the
      set was DERIVED (files seating a `platform_admin` hat × files naming an affected door, over
      **both** hat-seating syntaxes), not inherited from the four the rulings named. It is **nine
      assertions across five files** — `228:630-634` (+ a re-homed `lives_ok` twin under org
      authority) · `409` § 3.7 (*polarity **and** message*) · `415` § 1.2 (+ its § 1 header) ·
      `229:215-220`, which **splits in two** · ⭐ **`257_ethics_e2_retention.sql` :132/:141/:174/:209**,
      named by no ruling, which red *as if the retention bar had broken* (re-actored onto `oa_b`, plus
      one authority cell per pair) — **plus two green-but-dead-reason rewrites** in `315` (`:212` and
      `:246-249`, the eighth site ADR 0201's table calls unchanged). Old and proposed text for each:
      the plan file, approved as written; a red simply flipped to green with its message untouched is
      the failure this box exists to catch. (Superseded wording: *"the four expected reds"*.)
- [x] **The TS mirror follows (PO ruling R3)** — ✅ **ticked at the Record step** (`fa68436c`: 3 of 11
      Vitest cells RED on the two-conjunct text, 11/11 after; `src/` diff exactly the two files — QA §8).
      `src/lib/queries/session.ts:270` mirrors `app.is_admin()`'s
      two conjuncts for service-role paths that have **no RLS backstop**; it gains the same `is_active`
      term, keyed the same way, with a Vitest cell RED first. Without it the SQL fix *reads* complete.

**Gate.** `npm run lint` 0 errors / 0 warnings · `typecheck` · `npm run test` · `test:db` on a
fresh reset · the four authz arms with domains quoted · `SELFTEST=1` on the deriver **and** the door
harness · the set-valued targeted home · the diff-scoped deriver over `main...HEAD` with its
`SCOPE:` line quoted, its exit read **bare** before any substitution · the door sweep over **both
arms** on the derived cases · `git diff --name-only main... -- src` names **exactly**
`src/lib/queries/session.ts` and its Vitest spec (R3) and nothing else. ⛔ Someone other than the
builder runs the arms at the tip.
