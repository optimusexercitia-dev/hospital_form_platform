# ADR 0079 — AUTHZ door-blindness: the standing invariant + the write-policy keystone-isolation rule

- **Status:** Accepted (2026-07-18)
- **Context:** AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14). Branch `fix/authz-audit-door-blindness`.
- **Supersedes/relates:** ADR 0078 (authorization capability model); this records the FIX-B/FIX-C
  mechanism from the door-audit triage (`docs/reviews/authz-door-audit-triage.md`).

## Decision

**1. A door-blindness regression gate is now a standing invariant, not a one-off audit.**
`supabase/tests/mutation/p0-authz-invariant.sh` codifies §7.14 with two arms:

- **ARM 1 — BLIND ⊆ allowlist.** Re-runs the neutralization sweeps
  (`p0-authz-{door,writepath}-audit.sh`), unions their BLIND set, and asserts it is a subset of the
  committed `authz-blind-allowlist.txt`. A BLIND not on the allowlist fails the gate — that is a NEW
  authz gate no keystone exercises (the exact regression the known-3 rode). The allowlist is a
  **tracked follow-up backlog**, not a silent cap: every gate FIX-C keystones is deleted from it in
  the same commit.
- **ARM 2 — never-called-door floor.** With `track_functions=all`, after a full pgTAP run, asserts
  every `authenticated`-reachable `public` `prosecdef=t` door has `calls > 0`, except
  `authz-neverclled-door-allowlist.txt` (door-only / E2E-only). Catches a door that regresses to
  zero pgTAP coverage even if a policy audit would look complete.

The full ARM-1 sweep is ~90 min (the lead runs it in the background); a `FROMFINDINGS=1` fast mode
compares the committed findings for a light CI check. ARM 2 is ~1 min.

**2. Isolating an RLS *write* policy in a keystone requires a reader-non-writer principal, not a
fully-foreign one.**
An `UPDATE … WHERE` / `DELETE … WHERE` must locate the target row, and row location applies the
table's **SELECT** policy as well as the write policy. A fully-foreign (cross-org) principal fails the
SELECT policy, so the row is invisible and the statement touches 0 rows **regardless of the write
policy** — the keystone then passes even if the write policy is wide open (it is really testing the
SELECT gate). This is door-blindness *inside the keystone*. Proven live: opening
`case_referral_update_coord`/`_delete_draft_source` to `using(true)` did **not** let a rede-B principal
write, because `case_referral_select_readable` still hid the row.

**Rule:** a write-policy isolation keystone uses a principal who **can read** the row (passes the
SELECT policy) but is **not** authorized to write it (fails the write policy). For `case_referral` that
is a source-commission `staff` member (reads via `is_member_of`, cannot manage via
`is_staff_admin_of_for`). The write policy is then the sole gate under test, and opening it reddens the
keystone (mutation-proven). INSERT policies have no SELECT dependency, so a foreign principal is fine
there.

## Consequences

- Every FIX-C write-policy keystone is mutation-proven by reverting the policy to its OPEN form and
  requiring the keystone to redden (`p0b-isolation-mutation-audit.sh`); the reader-non-writer principal
  is what makes that redness attributable to the write policy.
- Each keystone carries a POSITIVE twin (the authorized principal DOES act) so a fail-closed regression
  (cf. [[d11]] stale-status delete) cannot masquerade as passing isolation. The mutation harness
  requires the negative to redden AND the twin to stay green.
- The two allowlists are living backlogs; ARM 1/ARM 2 surface additions and (non-fatally) flag stale
  entries that are now COVERED, to be pruned as batches land.
