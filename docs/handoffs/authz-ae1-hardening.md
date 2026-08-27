---
branch: authz-ae1-hardening
task: AE1 — integrity and privilege hardening (authz evolution)
adrs: [0155, 0160, 0161, 0079, 0133, 0152, 0156]
base_sha: ecd297b149032cc0a49cc875b200d8c53e91e672
created: 2026-08-27
updated: 2026-08-27
status: live
---

# Handoff — AE1 (authz evolution, ADR 0155 D9)

## ▶ RESUME HERE

1. `git log --oneline ecd297b1..HEAD && git status --short`
2. `docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc "select max(version), count(*) from supabase_migrations.schema_migrations;"`
3. Read **PROGRESS.md § Now**, then **[authz-ae1.md](../progress/authz-ae1.md)** — that file, not this one, is AE1's live record and carries the task table and the FUP obligations.
4. `npm run lint` (capture the exit code **directly**, never through a pipe).

⛔ Re-measure before relying on anything below — see § Trust.

## Trust

**Written as one compaction near the end of a long session, NOT incrementally** — treat the
VERIFIED table as reliable and the rest as recollection. Four agents were mid-flight, so the
tree described below is a moving target by construction.

## Goal and scope boundary

AE1 closes the debt that is independent of the authz catalog, so AE4's differential
oracle later runs against a clean floor. Six tasks: FKs (AE1.1), DEFINER classification
(AE1.2), the person-authority doors (AE1.3), the service-role registry (AE1.4), RLS
initplan triage (AE1.5), zero-policy tables (AE1.6).

⛔ **Explicitly NOT in scope:** executing any REVOKE (all **233** are HELD) · the `anon`
residue (PO decision) · fixing the platform-wide `actor_id = null` gap · `commissions` /
`commission_meeting_types` dedup (ruled out — § Dead ends) · anything in AE2+.

## State

### Done — VERIFIED

All 08-27 unless noted. Commits are on this branch.

| What | Witness |
| --- | --- |
| AE0 complete + recorded | `0b499417`; `docs/progress/authz-ae0.md` (08-26) |
| AE1.1 FKs, both `ON DELETE CASCADE` | `pg_get_constraintdef`: `confdeltype='c'` both, `appointed_by` still `'a'`; `14ad668d` |
| AE1.6 seven zero-policy tables | pgTAP 382 (68); `test:db` 230f/7631 PASS exit 0; `91455fbd` |
| AE1.4 registry, 45 sites | `backend-state.md` § Service-role DML registry, 45 rows counted; `800ffe2a` |
| AE1.2 classification, 752 fns | population re-derived by lead = 752 exactly; `f4df4f5f` |
| DB head + registry closure | `max(version)=20261003004710`, **480 registered == 480 on disk** |
| `lint` 10/10 | exit **0** at `ecd297b1`, dirty tree (agents' in-flight files included) |
| ADR 0160 + 0155 back-pointer | `adr:index` byte-compare; 159 ADRs, next free **0162** |

### Written but UNVERIFIED

- **AE1.3's six doors + predicate + 8 `_impl` kernels** (`…004600/004610/004620`, applied).
  Author reports pgTAP 384 (55) / 385 (49) / 386 (24) / 304 (44) `ok`, 13 objects re-read from
  the post-reset catalog, and `ARM=census` **RC=1 naming exactly `app.can_administer_person_for`**
  — R0's control satisfied. **Not independently re-measured by the lead.** Window-blocked and
  still owed: the 15-case mutation audit, the 1-case sweep + verdict, the follow-up `ARM=census`
  **green**, a real `test:db`.
- **AE1.5's `…004710`** (52-policy `auth.uid()` wrap) — applied; author reports 39 inlined
  per-row expansions → 0. AFTER capture and sweeps incomplete.
- **ADR 0161**, `.claude/rules/profiles-guard-never-widened.md`, the shared TS/SQL vectors,
  `supabase/tests/mutation/ae13-person-doors-mutation-audit.sh` — all present, uncommitted.
- `src/lib/users/actions.ts` converted to `.rpc()` call sites; `d14-person-level.test.ts`
  fixture updated (mutation-proved by its author, not by the lead).

### Not started

- **`npm run gen:types`** — ⛔ **the lead reserved it** and has NOT run it. `typecheck`
  currently **fails** on all six door names (`TS2345`, `src/lib/users/actions.ts` ~1049,
  1100, 1221, 1246, 1281) purely because `src/lib/types/database.ts` predates the doors.
  **This is the first thing to do once the DB is quiet.**
- RV0 revoke partition (`ae1-fk-build`, SQL ready, blocked on catalog access).
- The RV3 experiment (see § Open questions).
- AE1.5's 30 stale-verdict sweeps (see § Open questions).
- QA review, `e2e:prod`, Record step.

### Tree

Re-measured at update: HEAD **`5f0af8b3`**, **2 unpushed**, tree **dirty** — 6 modified,
19 untracked (agents' in-flight work). `docs/learning/` and
`scripts/progress-cleanup-2026-08-26.mjs` are **pre-existing untracked and not this
program's** — leave them.

⚠ **ANOTHER SESSION IS COMMITTING TO THIS BRANCH.** `6c91bfa9` (cap restructure) and
`5f0af8b3` (plan-audit fold-in + ADR 0162) were not written by the session that authored this
handoff, and one of them **edited this file**. ⛔ Do not assume you are the only writer:
`git log` before editing shared docs, and re-measure rather than trusting a clean `git status`
from a minute ago — a clean status is an instant, not a lease.

## Gates

| Arm / suite | SHA | Result | Exit |
| --- | --- | --- | --- |
| `ARM=census` / `hat` / `floor` / `wrapper` | AE0 baseline | 564 gates/600 verdicts · 6/6 self-test · 72 · BLIND 41 | 0 |
| `lint` (10 gates) | `ecd297b1` | OK | **0** |
| `test:db` | `14ad668d` | 231 files / 7638 | **0** |
| `typecheck` | `ecd297b1` | **FAIL** — expected, see § Not started | 2 |

**AE1.5's diff-scoped sweep, 2026-08-27 — ⛔ report it as UNPROVEN, not as a pass:**
`ARM=policy` measured **30 gates, 30 COVERED, BLIND 0, ERROR 0** — every one re-measured
against its post-`ALTER` predicate, none inherited. **But the run's verdict is exit 3,
UNPROVEN (PARTIAL)**: the other **22** cases are INSERT/UPDATE/DELETE policies that matched no
gate in the read arm. `p0-authz-writepath-audit.sh` is running on the same list. The 52 split
**31 `USING`-only / 8 `WITH CHECK`-only / 13 both**, which is exactly the 30/22.
⚠ `case_correction_requests_select` moved **BLIND → COVERED** — a verdict flip that must be
called out individually at merge, never folded into a count.
⚠ `ARM=predicate` reported **EMPTY DOMAIN — it did not hold, it did not run**; counted as
nothing. `out-of-domain-bool=35` is the unclassified-set size, **not** a defect count.
⛔ **Nothing merged into `docs/reviews/authz-door-audit-findings.md`** — `git diff --stat`
empty, plus the harness's own cksum confirmation. **Merge only once the combined run is
not-PARTIAL**, and then changed rows only, never a copy (ADR 0079 Amdt 1).

**Did NOT run:** `e2e:prod` (never, this phase) · QA review · the full ~5 h door sweep ·
the write-path arm over AE1.5's 22 · AE1.3's mutation audit and its 1-case sweep.

⛔ **One figure to disregard if you find it:** `test:db` `Files=235, Tests=7444, FAIL`. Eight
files aborted at `test_helpers.bootstrap()` on `deadlock detected` over
`truncate public.organizations cascade`, **zero assertion failures** — contention with a
parallel agent's revert, not a defect. Re-run on a quiet stack.

## Dead ends

- **The `profiles` duplicate-arm removal (migration `…004700`) was approved by the lead,
  built, and then WITHDRAWN.** Mechanism of failure, both halves measured:
  (a) the three duplicate SubPlans read **`never executed`** — earlier arms short-circuit
  them, so executed work was identical (652 → 650 buffers). The "~4× cost" in F-AE0-6 was
  caused by `SubPlan 3` at `loops=14`, **arm 3, not a duplicate**, which survives the edit.
  (b) pgTAP `371` §5.1 checks each `profiles` policy **by name** *because* both are
  permissive and OR'd — the duplication is what makes a per-policy half-applied-migration
  detector possible. The edit made it structurally unsatisfiable.
  ⭐ **The edit was bit-for-bit behaviour-preserving and still destroyed the instrument that
  proves behaviour was preserved.** Migration deleted, not compensated (never committed).
- **Applying migrations by hand via `psql`.** One agent did; it produced a catalog carrying
  13+ objects no registry row accounted for, making every sibling's reading unreproducible.
  All measurements taken against it were voided and re-run. ⛔ Do not repeat.
- **An AFTER-capture selector that tested the property under change** ("tables currently
  carrying an unwrapped `auth.uid()`"). BEFORE picked 29 tables, AFTER picked **0**, and
  diffing a full file against an empty one reads as a clean sweep. Caught only because zero
  InitPlans made no sense.
- **`pg_stat_user_tables` as a read-frequency instrument** — `n_live_tup = 0` everywhere and
  the top entries were the querying session's own queries.
- ⚠ **PA-F15 ("AE1.1's two FKs lack supporting indexes") is HALF right — the remedy is ONE
  index, not two.** Measured: `commission_administrativos` carries exactly one index, the PK on
  **`(commission_id, user_id)`**. `commission_id` is its **leading** column, so that FK **is**
  supported and needs nothing. `user_id` is **trailing**, and a btree on a composite does not
  support lookup by a trailing column alone — so only the `profiles` cascade would seq-scan.
  (Sibling `memberships` carries both `memberships_principal_idx` and `memberships_commission_idx`,
  which is the convention.) ⛔ Do not let "two missing indexes" propagate uncorrected.
- **Three specification errors in the approved door design**, all found by keystones rather
  than review: CPF normalised for the *comparison* but stored verbatim; `cpf` assumed to raise
  `check_violation` from the guard when it actually raises **`42501` from the column grant**
  (⚠ two independent layers — `authenticated` has **no `cpf` grant**, so the guard is never
  reached; `suspended_until` *is* granted and is what reaches the guard's identity arm); and
  the unknown-capability raise placed at the dispatch, where an `org_admin` returns `true`
  before reaching it.
- **The design doc's `search_path` spec was wrong, not the build.** Measured: **803** DEFINERs
  use `app, public, pg_catalog`; **zero** include `pg_temp`. The spec said `public, app,
  pg_temp` — wrong order, and introducing `pg_temp` where no DEFINER has it.
- ⛔ **`door-sweep-cases.sh` derives read AND write policies but its paste-able command names
  only the READ harness** (`p0-authz-door-audit.sh`), so the write half
  (`p0-authz-writepath-audit.sh`) goes silently unmeasured — 22 of 52 cases. Surfaced only
  because the read harness refuses to end CLEAN with unmatched cases. **A gap in the CLAUDE.md
  §6 step-1 recipe itself.**

## Decisions made in flight

**Ruled — recorded in-repo; read there, not here:**

- **R0–R6** → `docs/plans/authz-ae1-person-doors.md` §12 (door shape, `registerUser` reorder,
  ADR 0161, audit, vectors, the rules admission).
- **RV0–RV6** → `docs/design/authz-definer-classification-ae1.md` § LEAD RULINGS. Load-bearing
  one: **a revoke may not create sweep blindness** — revoking `authenticated` EXECUTE removes
  a function from `ARM=floor`'s domain. Partition is **delta-authoritative**, four buckets,
  `UNCHANGED (never swept)` kept separate from `PROCEED` because PROCEED asserts safety.
- **F-AE0-6 withdrawn** → `docs/design/authz-evolution-ae0-findings.md` §H.
- **Forward-only, operative form:** an **uncommitted** migration may be edited provided a full
  `db reset` rebuilds from files. Once committed or pushed, never.

**Provisional — needs the PO:**

- ✅ **ANSWERED by the PO 2026-08-27 — the cap was raised.** PROGRESS.md now **targets**
  80 KB (a non-fatal warning) and **hard-fails at 100 KB** (ADR 0124 Amdt 3;
  `scripts/check-progress-doc.mjs`). The ~6 owed FUP index lines fit: measured headroom went
  from **~40 bytes to ~20.5 KB**. ⚠ The *other* option in this item stays valid and is still
  the better move for anything nobody can act on next session —
  `docs/progress/deferred-backlog.md` **is** a live register for the orphan check, so an item
  carried there in full needs no PROGRESS.md line. The raised cap buys room; it does not
  retire the three-way test, and the 80 KB warning is the signal to rotate.

## Open questions / blockers

| Question | Who/what answers it |
| --- | --- |
| **30 gates carry a STALE `COVERED` verdict** after the `ALTER POLICY` wrap — name persists, predicate changed, and `ARM=census` does **not** backstop it (ADR 0079 Amdt 8 r3) | AE1.5 owner: sweep the 30, report before/after **per gate** |
| Does Postgres re-check EXECUTE inside a stored CHECK expression at write time? (5 fns, 8 constraints) | RV3 — one rolled-back txn, `BYPASSRLS` throwaway role, residue-check. Gates future revokes; **does not** bind the current 233 (those five are absent from it) |
| PROGRESS.md cap | PO — above |
| Are the 11 `UNDECIDED` `.rpc()` sites system-actor, self-scoped, or unprotected? | PO; listed in `backend-state.md` § Service-role DML registry |

## Next task

**In order, and the first two are the lead's:**

1. Wait for a quiet stack, then `npm run gen:types`, then `npm run typecheck` — the six
   `TS2345` errors must disappear. ⛔ If any survive, they are real and belong to the door
   call sites.
2. Grant the AE1.3 owner one **contiguous** window: `reset → 384/385/386 green → mutation
   audit → door sweep → ARM=census`. ⚠ **The door sweep MUTATES** (it neutralizes each gate);
   it is not a read, and its preflight refuses a dirty pgTAP baseline.
3. Then release the catalog to the RV0 partition owner.
4. Then: full `test:db` on a quiet stack, `e2e:prod`, QA review, Record step.

⛔ **Only ONE agent may hold the DB at a time.** Every reset is announced before and after.

## Re-derivation appendix

```bash
# tree + remote
git log --oneline ecd297b1..HEAD; git status --short
git rev-list --count origin/authz-ae1-hardening..HEAD

# db head + registry closure (must be equal)
docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc \
  "select max(version), count(*) from supabase_migrations.schema_migrations;"
ls supabase/migrations/*.sql | wc -l

# the four ARM arms — run from supabase/tests/mutation/, capture exit codes DIRECTLY
ARM=census bash p0-authz-invariant.sh; echo $?
ARM=hat    bash p0-authz-invariant.sh; echo $?
ARM=floor  bash p0-authz-invariant.sh; echo $?
FROMFINDINGS=1 ARM=wrapper bash p0-authz-invariant.sh; echo $?

# diff-scoped sweep case derivation — NEVER by hand; exit 1 is a finding, not a pass
bash scripts/door-sweep-cases.sh <phase-base>
git diff --stat -- docs/reviews/authz-door-audit-findings.md   # must be empty
```

⛔ **Catalog is truth** for every schema/RLS/RPC claim above — never a migration file, never
graphify. ⛔ **Never `ANALYZE`** before comparing against the AE0 baselines: this DB has **no
planner statistics** (`reltuples = -1`), so a cost-only diff is autovacuum, not a finding.
