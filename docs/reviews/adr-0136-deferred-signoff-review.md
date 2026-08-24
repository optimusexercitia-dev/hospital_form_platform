# QA review — ADR 0136, deferred `staff_admin` sign-off

**Scope:** commits `1069711c` (implementation) + `d899ceb3` (the five follow-ups + the
door sweep's predicate arm) + migration `20261003002000`.
**Date:** 2026-08-24. **Verdict: see § 7.**

---

## 1. Method, and the one thing that weakens this review

Requirements audited against ADR 0136 D1–D7; code read from the migration text **and**
verified against the live catalog where a body is re-emitted at runtime; security reviewed
at the RLS/DEFINER layer; tests reviewed for vacuity rather than for presence.

⛔ **THIS IS NOT AN INDEPENDENT REVIEW OF ALL OF IT, AND THE SPLIT MATTERS.** The reviewing
session **wrote `1069711c`**. For that commit this is a self-review, which is structurally
weaker than the `qa` teammate CLAUDE.md §6 step 3 asks for: the same reasoning that
produced a blind spot will not reliably find it. `d899ceb3` and `20261003002000` were
written by a different session and are reviewed here genuinely independently. ⚠ Read the
verdict with that asymmetry in mind — it is not a substitute for the phase-gate reviewer,
and § 7 says what it does and does not cover.

## 2. Requirements audit — D1…D7

| | requirement | verdict | evidence |
| --- | --- | --- | --- |
| D1 | gate splits by signer role; HC012 survives for `respondent` | ✅ | `submit_response`'s cursor widened to select `s.signoff_role`; the arm is `not (v_defer_staff_signoff and r_section.signoff_role = 'staff_admin')`. pgTAP 367 §2.6 pins the surviving respondent arm |
| D2 | deferral scoped to `case_phase_id is not null` | ✅ | `v_defer_staff_signoff := v_response.case_phase_id is not null and app.feature_enabled(...)`. 367 §1.4 pins that a STANDALONE response still raises HC012 with the flag ON |
| D3 | new `awaiting_signoff`, NOT in the settled set | ✅ | `case_phases_status_check` carries 6 values; 367 §3.4 asserts `awaiting_signoff` is **absent** from `activate_phase`, and §3.1 pins HC018 on a downstream phase. The absence is asserted, not assumed |
| D4 | `responses.status` unchanged | ✅ | no migration touches it; 367 §2.2 pins `submitted` on the frozen response |
| D5 | last signature completes + then computes | ✅ | `app.trg_complete_phase_on_signoff`; 367 §2.5 pins `result_computed_at is null` at submit, §4.3/§4.4 the completion |
| D6 | any `staff_admin`; **no** override, no per-person assignment | ✅ | audited: `can_sign_section`'s staff arm calls `app.is_staff_admin_of` **only** — no `is_tenancy_admin_of`, no `app.is_admin()`, no `member_can`. The obvious widening is absent |
| D7 | decline routes through correction/supersession; **no** unfreeze | ✅ | `file_correction_request` widened (phase targets only); 367 §8 walks the full loop file → draft → resubmit → approve → sign-the-successor, and §8.9 pins that `awaiting_signoff → active` is **refused** |

⚠ **D7 was not reachable as the ADR wrote it** — `file_correction_request` admitted
`completed` only. That is recorded in ADR 0136 § Amendment 1 A4 and is a change to the
ADR's stated design, not merely to its implementation. It is the right call (the
alternative is a permanent deadlock), but a reviewer should note that the PO ruled shape
(a) without the ADR's Consequences knowing shape (a) had no door.

## 3. The follow-up commit — reviewed independently

**`d899ceb3` is high-quality work and closes what it claims.** Three things stand out as
better than the bar:

- **FUP-DSS-SIGN-SECTION-INVOKER-VERDICT-STALE.** Re-measured honestly and the honest
  answer was **BLIND** — then hand-classified (none of `sign_section`'s `if` guards is the
  authorization gate; the gate is the RLS `WITH CHECK`, covered elsewhere). ⭐ **And the
  first fix did not work, which they measured rather than assumed:** a keystone keyed on
  SQLSTATE `23514` alone stayed green with the guard opened, because
  `guard_submitted_signoffs` shares both the window *and* the SQLSTATE. §14.1 is pinned to
  the wrapper's own **message**, the only thing that separates the two locks. That is the
  "a door can have two locks" trap caught in the act.
- **FUP-DSS-PENDING-SIGNOFFS-WALKTHROUGH-KEYSTONE.** They correctly identified that the
  sibling keystone shape ("the outsider reads 0 rows") would be **false** here — the helper
  has no gate by design — and instead pinned caller-blindness *as designed* and walked the
  boundary through the two consuming doors, with a non-vacuity twin beside every zero and
  a differential (§13.10-13.12) proving the "1" tracks the projection rather than being a
  constant. The outsider is `sa_y` (same org + hospital), deliberately not an org-B user,
  so the keystone exercises the commission gate rather than cross-org isolation.
- **FUP-DOOR-AUDIT-PREDICATE-ARM.** The arm now selects by NAME **or** PROPERTY, from one
  interpolated `PRED_DOMAIN` string so the two uses cannot drift. Measured effect: domain
  102 → 110, out-of-domain booleans 42 → 34. This is the durable fix, not the rename
  workaround the original follow-up settled for.

**Migration `20261003002000`** is correct and its reasoning is sound: the resume query was
lane-blind while the unique index it defers to is not, so a member holding an `in_progress`
case-phase draft was handed it back on the standalone route. The fix mirrors
`responses_one_draft_per_user_idx` exactly. Pinned red-first in 367 §15.

## 4. Security / RLS

- **The widening is bounded.** `can_sign_section` admits `submitted` only through
  `app.is_signoff_deferral_open`, which requires the phase to be `awaiting_signoff` **and**
  `current_response_id = r.id`. 367 §5.1/§5.2 pin that the window shuts on completion, and
  §8.6 that a **superseded** response drops out of it. Swept **COVERED** under the widened
  predicate arm.
- **The immutability carve-out is INSERT-only and structural.** `guard_submitted_signoffs`
  is a separate function; `guard_submitted_children` is provably untouched (367 §6.5 asserts
  its body contains neither `signoff` nor `awaiting`), which matters because that shared
  body still backs `answers` **and** `response_group_instances`.
- **No new principal gained anything.** D6 audited above; the only role that can sign is the
  one that could sign before.
- **Authz gates:** `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper` all **exit
  0** (read unpiped). Diff-scoped sweep: `can_sign_section` **COVERED**,
  `is_signoff_deferral_open` **COVERED**. `pending_staff_signoffs` **UNSUPPORTED** →
  backlogged with a walk-through keystone now written (§13).
- ⚠ **`public.start_or_resume_response`, changed by `20261003002000`, is INVOKER and
  already recorded UNSUPPORTED** in `authz-unswept-backlog.txt` ("no RLS probe / identity
  assert / identity condition to open"). Its change is a lane conjunct, not a gate, so no
  new sweep is owed — but it inherits that block's standing debt.

## 5. Test quality

pgTAP **367** is 79 assertions across 15 sections, with a flag-OFF arm asserted **first**
(the contract that actually ships), positive controls where a green could otherwise mean
"unreachable" (§7.2 pins that `eval_condition` still raises), and non-vacuity twins beside
the denials. 15 neutralizations were RED-proved during the build, each asserting the
mutation moved the body hash and the restore brought it back — one of which exposed a
**vacuous keystone** in the original work (`close_case`, whose fixture carried a `pending`
sibling so HC031 raised for the wrong reason).

## 6. Findings

**MINOR-1 — `20261003002000`'s header contradicts its own code.** The header reads:

> ⚠ ONE CONJUNCT CHANGES. Everything else — … the FF-4 default seeding on the create path,
> **the unique_violation re-read** — is byte-identical to the previous definition.

The `unique_violation` re-read **did** change: it gained the same `and case_phase_id is
null`, and the code's own comment in that block says so ("Same conjunct as the resume
branch"). Confirmed independently against the prior body
(`20260903000400_ff4_default_source_resolution.sql`, whose text is authoritative here — its
two `pg_get_functiondef` mentions are in comments, not runtime rewrites): the earlier
re-read had no such conjunct. **The shipped code is correct** — both sites needed it, and
changing only one would have been the defect. This is a documentation accuracy issue, and
it is filed because in this repo a comment is an assertion: a header that lists a changed
site among the unchanged ones is the class that goes stale silently and is believed.
**Fix:** move "the unique_violation re-read" out of the byte-identical list and say the
conjunct lands in two places.

**INFO-1 — the spec now outlives its own run, by necessity, with a residual coupling.**
`RUN_TAG` correctly makes leftovers harmless to *this* spec's selectors, and the reasoning
is right (a submitted response cannot be deleted; the FKs are `NO ACTION`). But the
leftovers are real rows in commission CCIH that survive until the next reset, so any spec
sharing a batch **after** this one sees an extra form/case. `RESET=1` per batch bounds it,
and the full run below is the empirical answer for the current suite composition — but the
bound depends on batch composition, which moves with `BATCH_TESTS` and with every spec
added. Recorded, not blocking.

## 7. Verdict

**APPROVED.** ✅ MINOR-1 was fixed in this pass (documentation only — the header now says the
conjunct lands in two places, and carries the correction and how it was verified). INFO-1 is
recorded, not blocking.

⛔ **What this verdict does NOT cover, stated so it cannot be read as more than it is:**

1. **It is a self-review of `1069711c`.** § 1. An independent `qa` pass over the original
   implementation is still owed if the phase gate is to be satisfied as written.
2. **The production flag flip is not written.** `deferred_staff_signoff` ships OFF; local
   and E2E are green **on the flag-ON path**, which is not what production runs. The
   flag-OFF contract is covered by 367 §1, and that is the only evidence about production
   behaviour that exists.
3. **Gate figures were taken on a stack shared with other sessions**, unknown at the time
   for the earlier runs. ADR 0136 § Amendment 1 § Gate record carries the qualification and
   the one attribution it makes unsafe.
