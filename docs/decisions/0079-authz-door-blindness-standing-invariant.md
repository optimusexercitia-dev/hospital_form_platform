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

## Amendment 1 — the invariant becomes a PHASE STEP, scoped to the diff (2026-08-04)

**Why.** The 2026-08-04 full ARM-1 sweep (the first since this ADR was written) returned
**INVARIANT VIOLATED: 15 BLIND gates**. Dating every BLIND policy by its creating migration gives
**20 allowlisted, all ≤ 2026-07-17; 15 violations, all ≥ 2026-07-18 — zero overlap.** 2026-07-18 is
the day the allowlist was written. The violations were not oversights by five teams; they were
*every RLS policy added since the invariant last ran*, from ETH·E2, Referrals-v2, Case Corrections,
an out-of-phase ETH hotfix, and Phase 16.

Decision 1 called this a "standing invariant" **in prose, but never in CLAUDE.md §6's numbered
list** — so it ran when someone remembered, which was never. Worse, Phase 16 *did* run it and logged
"INVARIANT HOLDS" having executed only `ARM=floor`; its own `accreditation_standards_select` passes
ARM 2 and fails ARM 1. A gate record naming the **script** instead of the **arm** reads as full
coverage while delivering the cheap half.

**Decision.** CLAUDE.md §6 step 1 now requires ARM 2 (~1 min) every phase, plus a **diff-scoped**
ARM 1 whenever the phase touched an RLS policy or a `prosecdef` boolean gate. Step 5 requires the
**arm** to be named in the record.

**The full sweep is deliberately NOT a phase step.** It is 302 cases / ~5 h and grows linearly with
the suite; mandating it per phase would reproduce the failure it is meant to fix (too expensive ⇒
satisfied nominally). It stays a periodic audit — pre-pilot, pre-release — lead-run in the
background. The evidence supports the split: of 83 BLINDs, **all 15 violations were newly-added
policies and none was an old gate that drifted** (the full sweep's only news about old surface was 4
entries that had *improved* and were pruned). New blindness is what a phase can cause; drift is what
a periodic audit catches.

**Adoptability was the deciding argument.** A "full ARM 1 must pass" gate cannot be switched on
while 15 violations are open — it would fail on day one, and the honest fixes are weeks of keystone
work. A diff-scoped gate examines only what the phase added, so it is adoptable **immediately** with
the 15 worked off as a backlog (FUP-AUTHZ-2).

### The recipe (derive the case list from the diff, never by hand)

```bash
git diff --name-only <phase-base>..HEAD -- supabase/migrations/ \
  | xargs grep -ohiE "create (or replace )?function (app|public)\.[a-z0-9_]+" \
  | sed 's/^.*\.//' | sort -u | grep -E "^(is_|can_|has_)" | grep -v "^is_valid_"
# + any `create policy <name>` added by the same diff
WORK=<scratch> CASES="<that list>" bash supabase/tests/mutation/p0-authz-door-audit.sh
```

Measured 2026-08-04 on MEM W4: **4 gates → 4m20s**, verdicts `3 COVERED / 1 ERROR / 0 BLIND`.

⚠ **Three operational hazards, each observed rather than predicted:**
1. **A subset run OVERWRITES `docs/reviews/authz-door-audit-findings.md`** with only its own cases —
   observed truncating the committed report from 300 lines to 2. `FINDINGS` is a fixed path with no
   env override. Always `git checkout --` it afterwards, or every phase silently destroys the audit
   record and the next full sweep's diff looks like a mass regression.
2. **`WORK` is hardcoded to a stale session scratchpad.** Override it, or the BLIND `.tsv`s that
   ARM 1 reads back are written somewhere else and the comparison is against the wrong run.
3. **The baseline must be green** — run on a fresh `supabase db reset`. The sweep aborts on a dirty
   baseline (§7.3), which is correct but wastes the run.

### `ERROR` is a recorded ceiling, not a pass

30 of 302 cases (28 door + 2 write-path) score `ERROR (run-shape!=baseline)`: neutralizing them
aborts files mid-transaction, so assertions never run and the harness refuses to score them either
way — a run that did not happen is not evidence. **The gap correlates with gate centrality**, which
is the inverse of where assurance is wanted: `app.has_role` alone leaves 259 tests unexecuted, then
`can_manage_referral_{source,target}` (101/61), `is_active`, `is_member_of_for`, `is_staff_admin_of*`,
`is_admin`. For the membership primitives ARM 1 can therefore **never** be the evidence; the
per-workstream targeted mutation audits are (`291` 9/9 · `292` 9/9 · `293` 8/8 · `294` 8/8 ·
`295` 13/13). A phase whose new gate scores `ERROR` owes a targeted mutation case instead.
