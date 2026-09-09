# QA Review — CAN-MANAGE-PROFESSIONAL-SELF-CHECK (pre-AE5 remediation Batch 8)

**Reviewed:** branch `authz-can-manage-professional-self-check`, tip `e696d107` (base `main` @
`4fe0c464`). **Reviewer:** qa. **Date:** 2026-09-09.

## Scope and method

Read: the hub (`docs/features/can-manage-professional-self-check.md`) and its full progress
record (`docs/progress/can-manage-professional-self-check.md`, all six dated entries);
`git log`/`git diff --stat` `main...e696d107`; the full text of the migration
(`20261003007360_can_manage_professional_subject_keying.sql`), pgTAP `415`, ADR `0200`, the diffs
of `406`, `410`, the three manifest/coverage/projection files, `door-sweep-cases.sh`,
`door-sweep-selftest.sh`, both new fixtures, `proposed-review.json`, `docs/decisions/INDEX.md`,
`docs/features/INDEX.md`; the FUP body and its register row; `docs/learning/LESSONS.md` for every
`LEARN-*` citation used in the migration/ADR/scripts (015, 018, 026, 048, 084, 089, 090, 091).

Independently queried the **live catalog** at the branch's own pair (confirmed
`(20261003007360, 525)` before anything else) — never the migration text, per ADR 0078:
- `pg_get_functiondef` for `can_manage_professional`, `can_read_professional_profile`,
  `is_admin`, `is_admin_for`, `is_org_admin_of`, `is_org_admin_of_for`,
  `can_manage_case_vocabulary` — bodies match the migration/ADR text verbatim.
- `authz.has_permission` for `chefe.ccih`/`staff1.qual.b` at Rede A's org — reproduces §0.6/0.7
  exactly (`t` / `f`).
- `pg_trigger` join reaching either predicate — `0`, confirming the reach table.
- `supabase/config.toml` `[api] schemas = ["public", "graphql_public"]` — confirms `app` is not
  PostgREST-exposed.
- `sha256sum` of `authz-enforcement-manifest.json` — matches the committed `manifestSha256`
  exactly, confirming the projection was regenerated, not hand-edited.
- The three `public` RPCs (`update_professional_profile`, `redact_professional_profile`,
  `set_professional_link_state`) all call `can_manage_professional` — confirms
  `FUP-PLATFORM-ADMIN-WRITES-CLASS-2-PROFESSIONAL-CONTENT`'s mechanism.
- `pg_proc` regex counts for `is_admin_for(`/`is_org_admin_of_for(` callers — 5 / 15, matching the
  ADR's "after" figures.

**Not run** (per the spawn instruction and the lead's L9/L11 rulings): the door sweep, the four
authz arms, the deriver self-test, `e2e:prod`, `test:db`. One attempt (`SELFTEST=1
door-sweep-cases.sh`) was blocked by the environment's own classifier as an execution the reviewer
should not perform; not retried, and not needed — the script diff, its self-test diff, and both new
fixtures were read in full and reasoned through by hand, plus the doctored-copy scenarios in the
record/ADR are independently plausible against the mechanism as read.

## Findings

No BLOCK or MAJOR findings.

**MINOR — the migration's AFTER landing assertions were not proven able to fire.** The BEFORE
block's double-apply test (record, "build" entry) proves the *BEFORE* guard's "already re-keyed"
branch fires. It does not exercise the *AFTER* block's failure branches (missing subject-keyed
arm, surviving caller-keyed arm, or a dropped preserved arm) — those are asserted correct by
reading, not demonstrated on a doctored body the way the door-sweep fixtures demonstrate the
deriver fix (LEARN-084's own standard: "prove the instrument can return the failing value at
all"). The risk is low — the checks are simple `position()` string tests over
`pg_get_functiondef()`, the same shape as `20261003007190`'s already-precedented pattern — but the
proof asked for by this batch's own review bar ("were they proven able to fire, not just
present") is not fully met for this half. Not blocking: recommend a one-line note in the migration
or a future batch add a doctored-body self-test for the AFTER assertions, analogous to the
door-sweep fixtures 14/15.

**NOTE — no observable exists yet for `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM`'s own closing
clause.** Per L8, the rewritten `Closes when` text is deferred to the Record step and does not
exist anywhere in this branch (grepped `docs/progress/`, `docs/features/`, ADR 0200 — none). This
is correct sequencing per the hub's own Acceptance criteria ("the entry stays open until the
Record step, after PO approval") and is not a defect in this branch, but it means this review
cannot assess whether the eventual replacement clause is well-formed — that check is owed **at**
the Record step, not here.

**NOTE — E2E run 2's `COVERAGE: accounted for 941 of 950`** is quoted in the record rather than
explained (the record itself flags this — "quoted, not explained"). 9 collected tests are
unaccounted for. Not a regression signal (no professional-identity-predicate spec is among the
seven failures, all seven reproduce the documented infra collapse signature, and all three failing
files pass 27/27 in isolation), but it is a loose end the lead should close out before or during
the Record step rather than let it stand as an unexplained gap in an otherwise fully-accounted
gate.

## Verified-facts list

- Migration lands exactly as documented: `can_manage_professional` body is
  `select p_uid is not null and (app.is_admin_for(p_uid) or app.is_org_admin_of_for(p_org, p_uid));`
  — `pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure)`.
- Both predicates `prosecdef = t`, unchanged signatures (`pronargs = 2` each) —
  `pg_proc` query.
- `app.is_admin()` retains its JWT-claim fast path (`request.jwt.claims ->> 'is_admin'`);
  `app.is_admin_for(p_user_id)` reads `public.profiles` directly with a caller-only ACT guard —
  `pg_get_functiondef` on both. Confirms the R3 tightening is real and correctly scoped to SELF.
- `app.is_org_admin_of_for` carries `app.is_active(p_user_id)`; `app.is_admin_for` does not —
  confirms `FUP-IS-ADMIN-ARM-IGNORES-PRINCIPAL-STATE`'s stated asymmetry.
- §0.6/0.7 of pgTAP 415: `authz.has_permission(chefe.ccih, 'organization', <Rede A org>,
  'org.professionals.read')` = `t`; same call for `staff1.qual.b` = `f` — reproduces exactly, which
  is why the over-grant cell in §2 correctly uses the cross-org subject `xb` and not `sa`.
- `app` schema absent from `supabase/config.toml`'s `[api] schemas` — confirms the "0
  client-reachable call sites" reach-table row.
- 0 triggers reach either predicate — `pg_trigger`/`pg_proc` join.
- `sha256sum supabase/tests/vectors/authz-enforcement-manifest.json` = the committed
  `manifestSha256` in `authz-matrix-coverage.json` — the projection is self-consistent with a
  generated regeneration, not a hand edit.
- `docs/decisions/0190-*.md` and `0193-*.md` both carry a generated `amended by 0200` back-pointer;
  `docs/decisions/INDEX.md` row for 0200 shows `⚠ proposed`, `amends 0190, 0193`, count updated to
  198 ADRs / next free 0201 — all consistent with the diff.
- `docs/decisions/proposed-review.json`: `0200` appended to `proposed`, `reviewed: null`
  untouched — matches the record's stated reasoning (no re-review of the other 8 actually
  happened).
- The five follow-ups drafted in the record (L7) are **not** present in
  `docs/followups/follow-ups-open.md` at this tip — confirms they were correctly held for the
  Record step rather than filed early.
- `git diff --stat main...e696d107` touches no file under `src/`, `supabase/seed.sql`, `CLAUDE.md`,
  or `docs/backend-state/` — confirms scope discipline (L11).
- The three `public` RPCs gated by `can_manage_professional`
  (`update_professional_profile`, `redact_professional_profile`, `set_professional_link_state`)
  all reference it in `prosrc` — confirms `FUP-PLATFORM-ADMIN-WRITES-CLASS-2-…`'s mechanism.
- `app.can_manage_case_vocabulary`'s body is `can_manage_professional(p_org, p_uid) or
  is_org_commission_staff_admin(p_org, p_uid)` — confirms the ADR's "transitively repaired
  sibling" claim by direct read.
- `professional_profiles_select`'s RLS qual has the permissive first CASE arm
  (`organization_id IN (select app.current_professional_read_organizations())`) that 415's header
  warns about, and its second arm calls `can_read_professional_profile(id, (select auth.uid()))`
  directly — confirms both that RLS legitimately self-keys (not a defect) and that 415's cells,
  which call the predicates directly rather than through this policy, are not vulnerable to being
  satisfied by the permissive arm.
- All eight `LEARN-*` citations used across the migration, ADR 0200, and the door-sweep diffs
  (015, 018, 026, 048, 084, 089, 090, 091) exist in `docs/learning/LESSONS.md` with content
  matching how they are invoked — no fabricated or misapplied citation found.
- Logical re-derivation of pgTAP 415's six red-first cells (1.1, 1.2, 1.3, 1.5, 2.1, 2.3) against
  the OLD (caller-keyed) bodies quoted in the FUP file and ADR 0200 §Problem reproduces the
  claimed pre-migration values (`true, false, false, true, true, false`) by hand, independent of
  the record's own quoted `psql` run.

## Could-not-verify (work items for the lead)

- **The AFTER landing assertions' ability to fire on a bad landing** — not demonstrated on a
  doctored body (see MINOR finding above). Recommend closing this before or at the Record step,
  not as a condition of this review's verdict.
- **The rewritten `Closes when` clause for `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM`** does not
  exist yet anywhere in the branch (correctly, per L8) — it must be reviewed for well-formedness
  (observable, machine-checkable, not closable by "no action") **at** the Record step, since this
  review has nothing to check it against.
- **The 9-test gap in E2E run 2's `COVERAGE: accounted for 941 of 950`** — the record quotes it
  without resolving it. Not evidence of a regression (reasoning above), but unexplained and should
  not be left standing past the Record step.
- **The door sweep (both arms), the four authz arms, the deriver self-test, and `e2e:prod` runs
  themselves** — not independently re-run by this review, per the spawn instruction; taken from
  the lead's tip-gate table (all bare rc 0 except the attributed E2E run-1 process-tree death,
  which the record itself declines to explain away). The mechanism behind the deriver fix and the
  door-sweep script diff were read and reasoned through directly rather than re-executed.

## Overall assessment

This is an unusually well-instrumented remediation: every prose count in the record and ADR 0200
that this review spot-checked against the live catalog reproduced exactly (bodies, `has_permission`
results, sha256 of the regenerated manifest, trigger/PostgREST-exposure counts, caller counts). The
tightening at SELF (R3) is declared in the migration header, the ADR's own Consequences section,
and pgTAP 415's own comment (§0.2) — never folded into a no-regression claim, as the review bar
required. Both defect sites get independently attributable bidirectional cells with masking arms
measured open and routed around rather than assumed shut. Scope discipline holds: nothing touched
outside the PO's rulings, and the five drafted follow-ups are correctly unfiled pending the Record
step. The one procedural gap (AFTER-assertion firing not proven) and two open loose ends (the
Closes-when replacement, the E2E coverage gap) are appropriately deferred to the Record step rather
than being defects in this branch.

---

**Verdict: APPROVED**
