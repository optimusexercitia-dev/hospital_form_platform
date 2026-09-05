# PRED-DOMAIN — progress record

Door-audit domain: pre-AE5 remediation Batch 2. The unit's **summary** is its hub,
[docs/features/pred-domain.md](../features/pred-domain.md) § Current state; this file is its
**log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `supabase/tests/mutation/p0-authz-door-audit.sh` (`PRED_DOMAIN`, the read arm's
`FOR ALL` handling, the §7.15 shape classifier), the committed baseline
`docs/reviews/authz-door-audit-findings.md` (re-earned through `scripts/lib/merge-findings-baseline.sh`),
`supabase/tests/mutation/act-hat-blind-sweep.sh:18` (stale domain sentence), and — if the ruling is
"targeted cases" — a committed, scheduled home for them (`ae3-targeted-cases.sh` is the precedent).
Decisions: ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (a green arm
bounds its own domain; hazard 4), [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md)
§4 (the `PRED_DOMAIN` bound routed to C2 — selection is the success criterion),
[0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) (the set-valued resolvers),
[0184](../decisions/0184-c2-sweep-runs-against-the-current-branch-schema.md) point 4 + [0187](../decisions/0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md)
D1 (the uncovered populations a gate record must state — trigger enforcers are the fourth),
[0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
(the deriver lifts the domain; the merge).

## Session log

### 2026-09-05 — unit opened (lead)

**Why now.** Batch 2 of the pre-AE5 batches ruled 2026-09-04. AE5's eleven per-role increments
re-key enforcement sites onto the `authz.*` resolvers — and today those resolvers are the population
the door-audit arm structurally cannot select: `authz.scope_reaches` and
`authz.candidate_has_permission` match neither the name nor the identity regex (35 `prosecdef`
booleans sit outside `PRED_DOMAIN`, 33 of them legitimately); `authz.authorized_scope_ids`,
`authz.candidate_authorized_scope_ids` and `app.current_professional_read_organizations` are
excluded by `t.typname = 'bool'` before any regex runs. Batches 0 and 1 made this batch safe to
run: the harness is crash-safe and the full run's merge preserves the baseline's hand-authored
material — this is the **first** real full run through that merge.

**Scope.** Five follow-ups (hub § Acceptance criteria) plus two carry-ins from Batch 1 (the
targeted case `9a4bbd22`'s door owes; `act-hat-blind-sweep.sh:18`). Explicitly NOT: the write-arm
33-of-107 re-baseline and `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Parts 2–4 (Batch 3 — its full
writepath run also goes through the merge, after this unit proves it on the door file); any change
to a production function, policy or migration; Tier 2's 190 doors (deferred by ADR 0171, **not**
cleared — every gate record citing the sweep says so).

**Facts at open** (from the follow-up bodies; every figure to be re-measured by the builder on a
fresh reset — the catalog has moved since each was filed):
- `PRED_DOMAIN` = `prosecdef` ∧ `typname='bool'` ∧ (name `^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)`
  ∨ identity regex over comment-stripped `prosrc`) ∨ `proname = 'assert_not_case_excluded'`,
  minus `PRED_SIDE_EFFECTING`; the deriver lifts it verbatim (ADR 0190), so a widening here
  changes the deriver's tier-2 set with no deriver edit.
- `scope_reaches` holds a hand-run targeted verdict (2026-09-02: 10 suites / 29 assertions
  noticed) — one function, once, outside any arm; `candidate_has_permission` holds **no** verdict.
- The three `SETOF uuid` resolvers hold hand-run targeted verdicts from the ADR 0182 increment;
  only `current_professional_read_organizations` has `authenticated` EXECUTE (census-domain); the
  two `authz.*` set resolvers hold EXECUTE for no application role (pgTAP 401 §18.1).
- Read arm bounds `polcmd in ('r','*')` and opens both halves of a `FOR ALL` policy at once
  (`p0-authz-door-audit.sh` ~`:807` when filed).
- `app.event_current_custodian` → ERROR because `140_patient_safety.sql` test 11 fails and the
  file ABORTS (`Bad plan. You planned 35 tests but ran 11`); §7.15 withholds the verdict.
- `app.guard_interview_status` (a trigger) delivers `HC038` on the fixture the suite uses; the
  trigger is in 0 of the 171 because a trigger has no call edge.
- The door baseline carries 399 verdict rows and 37 hand-annotated column-5 notes; a real full run
  lands 2 ≤ n ≤ 26 of them in `CARRIED` (QA measurement, Batch 1).

**Branch:** `authz-pred-domain` off `main` @ `bbda5392`.
