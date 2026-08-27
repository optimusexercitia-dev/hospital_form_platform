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

**Written as a single compaction near the end of a long session, NOT incrementally.**
Treat the VERIFIED table as the reliable part and everything else as recollection. Four
background agents were mid-flight at writing time, so the working tree described below
is a moving target by construction.

## Goal and scope boundary

AE1 closes the debt that is independent of the authz catalog, so AE4's differential
oracle later runs against a clean floor. Six tasks: FKs (AE1.1), DEFINER classification
(AE1.2), the person-authority doors (AE1.3), the service-role registry (AE1.4), RLS
initplan triage (AE1.5), zero-policy tables (AE1.6).

**Explicitly NOT in scope:**

- ⛔ **Executing any REVOKE.** AE1.2 classified; all **233** proposed revokes are HELD.
- ⛔ The `anon` residue (`FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED`) — PO decision.
- ⛔ Fixing the platform-wide `actor_id = null` audit gap — these doors are new instances.
- ⛔ `commissions` / `commission_meeting_types` duplicate-arm dedup — ruled out, see § Dead ends.
- ⛔ Anything in AE2+ (`home_organization_id` demotion, `profile_private_details`, the catalog).

## State

### Done — VERIFIED

| What | Witness | When |
| --- | --- | --- |
| AE0 complete, recorded, row in ledger | commit `0b499417`; `docs/progress/authz-ae0.md` | 08-26 |
| AE1.1 FKs, both `ON DELETE CASCADE` | `pg_constraint` / `pg_get_constraintdef`: `confdeltype='c'` on both, `appointed_by` still `'a'`; commit `14ad668d` | 08-27 |
| AE1.6 seven zero-policy tables | pgTAP 382, 68 assertions; `test:db` 230 files/7631 PASS exit 0; commit `91455fbd` | 08-27 |
| AE1.4 registry, 45 sites | `docs/backend-state.md` § Service-role DML registry, 45 rows counted; commit `800ffe2a` | 08-27 |
| AE1.2 classification, 752 functions | `docs/design/authz-definer-classification-ae1.md`; population re-derived by lead = 752 exactly; commit `f4df4f5f` | 08-27 |
| DB head + registry closure | `max(version)=20261003004710`, **480 registered == 480 `.sql` on disk** | 08-27 |
| `lint` 10/10 | exit **0** at `ecd297b1` over a dirty tree (agents' in-flight files included) | 08-27 |
| ADR 0160 + back-pointer on 0155 | `npm run adr:index` byte-compare; 159 ADRs, next free **0162** | 08-27 |

### Written but UNVERIFIED

- **AE1.3's six doors + predicate + 8 `_impl` kernels** — migrations `…004600/004610/004620`
  applied; author reports pgTAP 384 (55) / 385 (49) / 386 (24) / 304 (44) all `ok`, all 13
  objects re-read from the post-reset catalog, and `ARM=census` **RC=1 naming exactly
  `app.can_administer_person_for`** — R0's positive control satisfied. **Not independently
  re-measured by the lead.** Still owed, all window-blocked: the 15-case mutation audit, the
  1-case sweep + its verdict, the follow-up `ARM=census` **green**, and a real `test:db`.
  ⚠ Its 15 mutation needles were pre-resolved against live `pg_get_functiondef` (a
  `replace()` that misses rewrites the body unchanged and reports GREEN).
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

`base_sha` **`ecd297b1`**, **2 commits unpushed**, working tree **dirty** with four agents'
in-flight work: 7 modified files, ~17 untracked. `docs/learning/` and
`scripts/progress-cleanup-2026-08-26.mjs` are **pre-existing untracked and not this
program's** — leave them.

## Gates

| Arm / suite | SHA | Result | Exit |
| --- | --- | --- | --- |
| `ARM=census` / `hat` / `floor` / `wrapper` | AE0 baseline | 564 gates/600 verdicts · 6/6 self-test · 72 · BLIND 41 | 0 |
| `lint` (10 gates) | `ecd297b1` | OK | **0** |
| `test:db` | `14ad668d` | 231 files / 7638 | **0** |
| `typecheck` | `ecd297b1` | **FAIL** — expected, see § Not started | 2 |

**Did NOT run:** `e2e:prod` (never, this phase) · QA review · the full ~5 h door sweep ·
`ARM=policy` diff-scoped over AE1.5's 52 · AE1.3's mutation audit.

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
- **`pg_stat_user_tables` as a read-frequency instrument** — `n_live_tup = 0` on every public
  table and the top entries were the querying session's own queries.
- **Three specification errors in the approved door design**, all found by keystones rather
  than review: CPF normalised for the *comparison* but stored verbatim; `cpf` assumed to raise
  `check_violation` from the guard when it actually raises **`42501` from the column grant**
  (⚠ two independent layers — `authenticated` has **no `cpf` grant**, so the guard is never
  reached; `suspended_until` *is* granted and is what reaches the guard's identity arm); and
  the unknown-capability raise placed at the dispatch, where an `org_admin` returns `true`
  before reaching it.
- **The design doc's `search_path` spec was wrong, not the build.** Measured: **803** of the
  DEFINER population use `app, public, pg_catalog` and **zero** include `pg_temp` — the spec
  said `public, app, pg_temp`. Wrong order, and it would have introduced `pg_temp` where no
  DEFINER has it.
- ⛔ **`door-sweep-cases.sh` derives read AND write policies but its paste-able command names
  only the READ harness** (`p0-authz-door-audit.sh`). An operator following its own output
  sweeps half the case list; the write half (`p0-authz-writepath-audit.sh`) goes silently
  unmeasured. Surfaced because the read harness refuses to end CLEAN with unmatched cases —
  22 of 52. **This is a gap in the CLAUDE.md §6 step-1 recipe itself.**

## Decisions made in flight

**Ruled** (all recorded in-repo, not only here):

- **R0–R6** → `docs/plans/authz-ae1-person-doors.md` §12. Key: the door shape is restructured
  because a `public` DEFINER returning `void`/`uuid` granted to `service_role` only is in
  **no ARM's domain**; authority moves into a `bool` `can_`-named predicate. `finalize` uses
  the ordinary predicate via a `registerUser` reorder (Option A) — Option B would have
  **widened** `hospital_admin` authority.
- **RV0–RV6** → `docs/design/authz-definer-classification-ae1.md` § LEAD RULINGS. Key:
  **a revoke may not create sweep blindness** — revoking `authenticated` EXECUTE removes a
  function from `ARM=floor`'s domain. Partition is **delta-authoritative**, four buckets, with
  `UNCHANGED (never swept)` kept separate from `PROCEED` because PROCEED asserts safety.
- **F-AE0-6 withdrawn** → `docs/design/authz-evolution-ae0-findings.md` §H. Three corrections
  to one finding, **all overstating**; every remaining quantitative claim there is marked
  unverified until re-measured.
- **Forward-only, operative form:** an **uncommitted** migration may be edited provided a full
  `db reset` rebuilds from files. Once committed or pushed, never.

**Provisional — needs the PO:**

- **PROGRESS.md is at ~40 bytes of headroom** against its 80 KB cap and AE1 owes ~6 more FUP
  index lines (~1800 bytes). Rotation has stopped working: OPEN index lines are protected, no
  resolved lines exist to archive, and each compressed narrative is replaced by an index line
  of near-equal length. Measured: `docs/progress/deferred-backlog.md` **is** a live register
  for the orphan check (`scripts/check-progress-doc.mjs:246`), so bodies indexed there need no
  PROGRESS.md line. **Options put to the PO: route AE1's remaining obligations to
  deferred-backlog, or raise the cap by ADR (ADR 0140 — a PO decision, never a lead's).**
  ⛔ Unanswered at handoff.

## Open questions / blockers

| Question | Who/what answers it |
| --- | --- |
| **30 gates carry a STALE `COVERED` verdict** after AE1.5's `ALTER POLICY` wrap — the name persists, the predicate changed, and `ARM=census` does **not** backstop it (ADR 0079 Amdt 8 ruling 3) | assigned to the AE1.5 owner: sweep the 30, report before/after **per gate** |
| Does Postgres re-check EXECUTE on a function inside a stored CHECK expression at write time? (5 functions, 8 constraints) | RV3 experiment — one rolled-back txn, `BYPASSRLS` throwaway role, residue-check `pg_roles` + ACLs. ⛔ Gates any future revoke touching a constraint-referenced function. **Does not** bind the current 233 — those five are absent from the set |
| PROGRESS.md cap | PO — see above |
| Are the 11 `UNDECIDED` `.rpc()` sites system-actor, self-scoped, or unprotected? | PO; listed in `docs/backend-state.md` § Service-role DML registry |

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

⛔ **The catalog is truth** for every schema/RLS/RPC claim above — `pg_proc` (incl.
`prosecdef`), `pg_policies`, ACLs. Never a migration file, never graphify.
⛔ **Never `ANALYZE`** before comparing against the AE0 EXPLAIN baselines: this DB has **no
planner statistics** by design (`reltuples = -1`), and a cost-only diff is autovacuum noise,
not a finding.
