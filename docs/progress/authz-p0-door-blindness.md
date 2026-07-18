# AUDIT-DOOR-BLINDNESS P0 — record (✅ COMPLETE 2026-07-18)

**Status:** ✅ COMPLETE — qa APPROVED, **human-approved 2026-07-18**. Branch `fix/authz-audit-door-blindness`
→ ff-merged to `main` (local, not pushed). **Unblocks S4.**
**Charter:** ADR [0078](../decisions/0078-authorization-capability-model.md) §7.14 — a keystone that checks one
authorization layer and infers the adjacent one is blind by construction (it shipped green over 5 live leaks in
one day). Closed with a catalog-driven neutralization oracle + a standing invariant.
**Full triage + fix plan:** [authz-door-audit-triage.md](../reviews/authz-door-audit-triage.md) ·
**qa verdict:** [authz-door-audit-p0-review.md](../reviews/authz-door-audit-p0-review.md) ·
**ADR:** [0079](../decisions/0079-authz-door-blindness-standing-invariant.md).

## Pre-req fixed (`a32be9c`)
Clean `supabase db reset` was aborting on `20260801000000` — `core.autocrlf=true` checked out 140/146 migrations
CRLF, storing `\r` into `prosrc` so an LF-anchored `pg_get_functiondef()+replace()` guard injection matched
nothing. Fix: `*.sql text eol=lf` in `.gitattributes`. **Also unblocks the pilot reset** (same `db reset` path).

## Sweep (P0-U0) — 292 neutralization cases
Oracle (proven): neutralize each authz gate → run the pgTAP suite → `Result: FAIL` = a keystone asserts through
it (COVERED); `Result: PASS` = nothing noticed (BLIND). Harnesses:
`supabase/tests/mutation/p0-authz-{door,writepath}-audit.sh`.
- Read/door arm (252): 135 COVERED · 93 BLIND · 24 ERROR. Write arm (40): 9 COVERED · 29 BLIND · 2 ERROR.
- Reachability triage (Rule 1): door-only backstops `event_patient`/`patient_xref`/`notifications` (grant
  revoked ⇒ PostgREST can't reach them; audited DEFINER door is the boundary). ~78 reachable gates were
  **untested-but-correct** (every crown-jewel qual = a correct, separately-COVERED predicate). **No live leak.**
- Finding: door-blindness is **platform-wide test-coverage debt**, not a Gate-1 breach.

## FIX-A — the 26 ERROR core predicates → ALL COVERED (via runlogs, no new keystones)
Every ERROR run was `Result: FAIL` with authz-keystone failures (`has_role` 529 … `can_sign_meeting` 1); the
run-shape drop was a *collateral* fixture abort, not a coverage gap. The load-bearing predicates
(`is_commission_admin_of` [67 doors], `has_role`, `is_staff_admin_of`, `is_member_of`, `is_org_admin_of`,
`is_active`, `is_admin`, nsp/pqs variants) are all heavily asserted. **Zero blind core predicates.**
Nit: `can_sign_meeting` has single-keystone (thin) coverage.

## FIX-B — the standing invariant (`p0-authz-invariant.sh`, ADR 0079)
- **ARM 1:** re-runs both sweeps, asserts BLIND ⊆ `authz-blind-allowlist.txt` (a new un-keystoned authz gate ⇒
  non-zero exit). `FROMFINDINGS=1` fast mode for CI.
- **ARM 2:** never-called-door floor — `track_functions=all` + full suite, every authenticated-reachable `public`
  `prosecdef` door must have `calls>0` except `authz-neverclled-door-allowlist.txt` (E2E-only baseline).
- **INVARIANT HOLDS** (authoritative live run): BLIND=72 all-allowlisted; 93 never-called doors floored.

## FIX-C — 50 mutation-proven isolation keystones (`supabase/tests/25{0,1,2}_authz_p0_isolation.sql`)
Proven by `supabase/tests/mutation/p0b-isolation-mutation-audit.sh` — revert each gate → its keystone reddens;
CONTROL all-green (14/40/48). Each keystone: non-vacuous (asserts against a row that EXISTS), DENY + POSITIVE
twin (a fail-closed regression can't pass as isolation).
- **Batch 1** (`ecc5ac3`): 3 write-guards (`assert_session_writable`/`assert_referral_draft_writable`/
  `assert_referral_target_acts`) + `case_referral` write family; [[d11]] fail-closed term re-verified live.
- **Batch 2** (`46539ad`): 20 direct-DML write policies — meeting family, `rca`/`capa_plan`/`case_interviews`
  writes, signoffs, `profiles_admin_insert`. The 2 `profiles`-UPDATE ERRORs resolved COVERED via runlogs.
- **Batch 3** (`611607d`): 24 clinical/case-content — `rca_*`/`capa_*` FOR-ALL writes, `case_phase_*`/
  `case_participant_roles`/`case_tag`/`interview_sessions` writes + 6 read reps.
- **⭐ Load-bearing discipline (ADR 0079): reader-non-writer principal for every UPDATE/DELETE/FOR-ALL policy** —
  an `UPDATE/DELETE … WHERE` also applies the SELECT policy to locate the row, so a fully-foreign principal is
  stopped by the SELECT gate and the write-policy mutation can't redden ("door-blindness inside the keystone").
  Use a principal who can READ but not WRITE, so the redness is attributable to the write policy.
- Allowlist = **72** (post MINOR-1 prune): represented-by-group reads (same predicate as a keystoned rep),
  door-only backstops, benign predicate wrappers, low-severity config/catalog. A **tracked follow-up backlog**
  the invariant surfaces — not silent drops.

## Verification (lead + qa each independent, live — §7.14)
Baseline pgTAP `PASS` (Files=115, Tests=3288, 0 `not ok`); `p0b` **50/50 RED-PROVEN**, 3 controls all-green;
invariant HOLDS; live foreign-principal leak spot-check = **0 rows** against seeded `professional_profiles` +
`event_custody` (non-inferential). **qa: ✅ APPROVED — 0 P0 / 0 MAJOR / 2 MINOR (hygiene) / 1 INFO.**
MINOR-1 (2 now-covered allowlist entries) pruned at Record.

## Follow-up backlog (invariant-surfaced, not silent)
- Burn down the 72 allowlisted gates (low-severity config/catalog + represented-by-group reads) with keystones.
- `can_sign_meeting` thin single-keystone coverage.
- The full ~90-min invariant sweep is the standing CI gate (run once before any future merge to origin).
