---
branch: authz-ae1-hardening
task: AE1 — integrity and privilege hardening (authz evolution)
adrs: [0155, 0160, 0161, 0162, 0079, 0133, 0152, 0156]
base_sha: f121c031
created: 2026-08-27
updated: 2026-08-27
status: live
---

# Handoff — AE1 (authz evolution, ADR 0155 D9)

## ▶ RESUME HERE

1. `git log --oneline f121c031..HEAD && git status --short`
2. `docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc "select max(version), count(*) from supabase_migrations.schema_migrations;"` — expect `20261003005000 | 481` unless someone migrated after this update.
3. Read **PROGRESS.md § Now**, then **[authz-ae1.md](../progress/authz-ae1.md)** — that file, not this one, is AE1's live record: the task table, the **AMENDED close conditions** (plan audit → ADR 0162), and the FUP obligations.
4. `npm run typecheck` — **expected: FAIL with exactly the 11 TS2322 errors named in § State**. Anything else is new.

⛔ Re-measure before relying on anything below — see § Trust.

## Trust

Two writers: the lead's compaction (written near end-of-context, four agents mid-flight) and a
**2026-08-27 update by the rulings/verification session** — every figure that session touched was
freshly measured the same day (witnesses inline) with the other sessions **paused** and the DB
owned. The VERIFIED table is reliable; § UNVERIFIED is the doors/initplan owners' reported state,
partially upgraded by the post-reset suite run.

## Goal and scope boundary

AE1 closes the debt that is independent of the authz catalog, so AE4's differential
oracle later runs against a clean floor. Six tasks: FKs (AE1.1), DEFINER classification
(AE1.2), the person-authority doors (AE1.3), the service-role registry (AE1.4), RLS
initplan triage (AE1.5), zero-policy tables (AE1.6). ⚠ **The close conditions were
AMENDED 2026-08-27** (plan audit → ADR 0162; `[PA-F#]` tags in the plan) — the binding
list is [authz-ae1.md](../progress/authz-ae1.md) § close conditions.

⛔ **Explicitly NOT in scope:** executing any REVOKE (all **233** are HELD) · the `anon`
residue (PO decision) · fixing the platform-wide `actor_id = null` gap · `commissions` /
`commission_meeting_types` dedup (ruled out — § Dead ends) · anything in AE2+.

## State

### Done — VERIFIED

All 08-27 unless noted. Commits are on this branch.

| What | Witness |
| --- | --- |
| AE0 complete + recorded | `0b499417`; `docs/progress/authz-ae0.md` (08-26) |
| AE1.1 FKs, both `ON DELETE CASCADE` | `pg_get_constraintdef`: `confdeltype='c'` both; `14ad668d` |
| AE1.6 seven zero-policy tables | pgTAP 382 (68 asserts); `91455fbd` |
| AE1.4 registry, 45 sites | `backend-state.md` § Service-role DML registry; `800ffe2a` |
| AE1.2 classification, 752 fns | population re-derived by lead = 752 exactly; `f4df4f5f` |
| Plan audit folded in + **ADR 0162** (amends 0155) | `5f0af8b3`; `docs/reviews/authz-evolution-plan-audit-2026-08-27.md` |
| **The 11 `.rpc()` rulings — APPROVED + RECORDED** | `90b188fd`; `docs/design/authz-ae1-rpc-rulings.md` (R3 discharged: local↔remote body-md5 parity, all 9 fns); registry Group E has **zero `undecided`** |
| **Minutes-latch fix `…005000` + pgTAP 388 VERIFIED** | `90b188fd`/`2448a655`; fresh reset → `test:db` **236 files / 7,855 tests PASS, exit 0**; 388 `ok` by name in the log |
| **Stack NORMALIZED by that reset** | `…004600–004710` now registry-applied; `max(version)=20261003005000`, **481 registered == 481 on disk** |
| `gen:types` at head `…005000` | `f121c031`; +67 lines, six door RPC signatures present, **zero pgtap pollution** |
| `lint` 10/10 | exit **0** at the `f121c031` tree (measured directly, no pipe) |
| vitest full | **144 files / 1,964 tests, exit 0** at the `f121c031` tree (includes the doors owner's updated d14 fixture + the new caller-census test) |

### Written but UNVERIFIED

- **AE1.3's six doors + predicate + 8 `_impl` kernels** (`…004600/004610/004620`). ⭐ Upgraded
  by the post-reset run: pgTAP **384/385/386/387 ran GREEN inside the full 236-file suite** on a
  fresh, registry-applied stack — no longer only the author's report. **Still owed:** the
  15-case mutation audit, the 1-case door sweep + verdict, a follow-up `ARM=census` **green**
  (its RC=1 naming `app.can_administer_person_for` was R0's control, pre-normalization).
- **AE1.5's `…004710`** (52-policy `auth.uid()` wrap) — applied + suite-green post-reset;
  AFTER-capture and the 30 stale-verdict sweeps incomplete (§ Open questions).
- `.claude/rules/profiles-guard-never-widened.md`, the shared TS/SQL vectors
  (`scripts/gen-person-scope-vectors.mjs` + fixtures + `vectors/person_scope_vectors.psql`),
  `ae13-person-doors-mutation-audit.sh`, `docs/design/authz-ae1-{initplan-triage,revoke-partition}.md`
  — present, **uncommitted** (ADR 0161 itself was committed in `5f0af8b3`).
- `src/lib/users/actions.ts` converted to `.rpc()` call sites — uncommitted, and **carries the
  11 named type errors below**.

### Not started

- ⛔ **The 11 surviving `typecheck` errors — the doors owner's first task.** All TS2322
  `string | null` vs generated `string | undefined`/`string`, in `src/lib/users/actions.ts` at
  748, 749, 788, 793, 999, 1001, 1006, 1009, 1065, 1070, 1297 (measured at `f121c031`). The six
  old TS2345 door-name errors are **gone** (`gen:types` done); these are the real payload-shape
  mismatches the lead predicted would "belong to the door call sites". Fix at the call sites
  (null→undefined coercion) or by revisiting the door arg declarations — the owner's call.
- RV0 revoke partition (`ae1-fk-build`, SQL ready) — the DB is now quiet for it.
- The RV3 experiment (§ Open questions).
- AE1.5's 30 stale-verdict sweeps + the write-path arm's 22 cases (§ Gates).
- Amended close conditions still open: **#2** ADP global-`FOR ROLE` form + positive ACL probes ·
  **#3** the tiered DEFINER review over the classification (binds RV0's held revokes) ·
  **#4** ⚠ ONE supporting index (`user_id` — see § Dead ends, PA-F15 is half-right) ·
  **#5** flake fingerprints · **#6** the six `TO public` process-template policies ruling.
- `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` (R2 — a condition of the `complete_minutes_job` ruling).
- QA review, `e2e:prod`, Record step (⚠ PROGRESS.md is ~85 KB vs the 82 KB rotation target —
  rotate at Record; and re-check C1a still heads the ▶ queue, rule G10).

### Tree

Measured at update: HEAD **`f121c031`**, **4 unpushed** (`5f0af8b3` plan-audit/0162 ·
`90b188fd` rulings+latch · `2448a655` verification record · `f121c031` types), tree **dirty**:
5 modified (`users/actions.ts`, `person-scope.ts`, `d14-person-level.test.ts`,
`270_ff1_repeating_groups.sql`, `304_affiliation_lifecycle.sql` — all the doors owner's) +
untracked in-flight files listed in § UNVERIFIED. `docs/learning/` and
`scripts/progress-cleanup-2026-08-26.mjs` are **pre-existing and not this program's** — leave them.

⚠ **Multiple sessions have committed to this branch.** As of this update the others are
**PAUSED** and the DB was owned by the updating session — freshly reset, quiet, nothing holding
connections beyond the stack's own services. **The successor inherits DB ownership**; announce
resets in the live record, one owner at a time.

## Gates

| Arm / suite | Tree | Result | Exit |
| --- | --- | --- | --- |
| `test:db` (post-reset, fresh) | `2448a655` tree | **236 files / 7,855 — PASS** | **0** |
| `lint` (10 gates) | `f121c031` tree | OK | **0** |
| vitest (full) | `f121c031` tree | 144 / 1,964 pass | **0** |
| `typecheck` | `f121c031` tree | **FAIL — the 11 named TS2322** | 2 |
| `ARM=census`/`hat`/`floor`/`wrapper` | AE0 baseline | 564 gates/600 verdicts · 6/6 · 72 · BLIND 41 | 0 |

**AE1.5's diff-scoped sweep — ⛔ still UNPROVEN, not a pass:** `ARM=policy` measured **30
COVERED, BLIND 0** but exited **3 UNPROVEN (PARTIAL)** — the other **22** cases are write
policies outside the read arm's domain; the write-path harness's own defect is filed
(`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED`: it computed a residual over an empty set and exited 0).
⚠ `case_correction_requests_select` moved BLIND → COVERED — call out individually at merge.
⛔ Nothing merged into `docs/reviews/authz-door-audit-findings.md` (`git diff --stat` empty);
merge only once the combined run is not-PARTIAL, changed rows only.

**Did NOT run (deliberate):** `e2e:prod` (never, this phase) · QA review · the full ~5 h door
sweep · AE1.3's mutation audit + 1-case sweep · **the ARM arms post-reset** — the doors are
mid-flight, so a census run now reds expectedly on their not-yet-inherited arms; that run
belongs to the AE1.3 owner's contiguous window, not to a bystander.

⛔ Stale figure to disregard if found: a `test:db` `235/7444 FAIL` — deadlocks from a parallel
agent's revert, zero assertion failures; superseded by the quiet-stack **236/7,855 PASS** above.

## Dead ends

- **The `profiles` duplicate-arm removal (migration `…004700`) was approved, built, and
  WITHDRAWN.** (a) the three duplicate SubPlans read `never executed` — earlier arms
  short-circuit them (652 → 650 buffers); F-AE0-6's "~4×" came from arm 3, which survives.
  (b) pgTAP `371` §5.1 checks each `profiles` policy **by name** *because* both are permissive
  and OR'd — the edit was behaviour-preserving and still destroyed the instrument that proves
  behaviour was preserved. Deleted, never committed.
- **Applying migrations by hand via `psql`** — produced a catalog with 13+ unregistered
  objects; every sibling measurement voided. ✅ **Divergence normalized by the 08-27 reset**;
  the prohibition stands.
- **An AFTER-capture selector that tested the property under change** ("tables currently
  carrying an unwrapped `auth.uid()`") — AFTER picked 0 tables and read as a clean sweep.
- **`pg_stat_user_tables` as a read-frequency instrument** — `n_live_tup = 0` everywhere;
  top entries were the querying session's own queries.
- ⚠ **PA-F15 is HALF right — the remedy is ONE index, not two.** `commission_administrativos`'
  PK is `(commission_id, user_id)`: `commission_id` is leading (that FK is supported);
  `user_id` is trailing (the `profiles` cascade would seq-scan). Add the `user_id` index only.
- **Three specification errors in the approved door design**, found by keystones: CPF
  normalised for comparison but stored verbatim; `cpf` writes raise **`42501` from the column
  grant**, never reaching the guard (`suspended_until` *is* granted and does); the
  unknown-capability raise sat where `org_admin` returned `true` first.
- **The design doc's `search_path` spec was wrong, not the build** — 803 DEFINERs use
  `app, public, pg_catalog`; zero include `pg_temp`.
- ⛔ **`door-sweep-cases.sh` derives read AND write policies but its paste-able command names
  only the READ harness** — the write half goes silently unmeasured (22 of 52). A gap in the
  CLAUDE.md §6 step-1 recipe itself; filed.
- **The minutes-job "status latch" was a read, not a latch** — SELECT-then-unconditional-UPDATE
  let concurrent callbacks both win. Fixed by `…005000` (latch inside the UPDATE + `FOUND`);
  pgTAP 388 §3's text pins were proven RED on the old bodies first. Mechanism recorded so
  nobody re-introduces the SELECT-then-UPDATE shape for "readability".

## Decisions made in flight

**Ruled — recorded in-repo; read there, not here:**

- **R0–R6** → `docs/plans/authz-ae1-person-doors.md` §12.
- **RV0–RV6** → `docs/design/authz-definer-classification-ae1.md` § LEAD RULINGS. Load-bearing:
  **a revoke may not create sweep blindness** (it removes the fn from `ARM=floor`'s domain).
- **The 11 `.rpc()` rulings** → `docs/design/authz-ae1-rpc-rulings.md` — approved as-is
  2026-08-27 + four PO observations (1 fixed = `…005000`; 3 FUPs:
  `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` · `FUP-DOC-RECLASS-OPERATION-ID` ·
  `FUP-DOC-DISPOSAL-PROVENANCE-SPLIT`).
- **Plan-audit dispositions** → ADR 0162 + `[PA-F#]` tags in `docs/plans/authz-evolution.md`.
- **F-AE0-6 withdrawn** → `docs/design/authz-evolution-ae0-findings.md` §H.
- **Forward-only, operative form:** an **uncommitted** migration may be edited provided a full
  `db reset` rebuilds from files. Once committed or pushed, never.
- **PROGRESS.md caps** → ADR 0124 Amdt 3 (80 KB target / 100 KB hard); the 80 KB warning is
  live — rotate at Record.

## Open questions / blockers

| Question | Who/what answers it |
| --- | --- |
| **30 gates carry a STALE `COVERED` verdict** after the `ALTER POLICY` wrap — name persists, predicate changed; `ARM=census` does **not** backstop it | AE1.5 owner: sweep the 30, before/after **per gate** |
| Does Postgres re-check EXECUTE inside a stored CHECK expression at write time? (5 fns, 8 constraints) | RV3 — one rolled-back txn, throwaway `BYPASSRLS` role. Gates future revokes; does **not** bind the current 233 |
| The 11 TS2322 fixes: coerce at call sites or change door arg declarations? | AE1.3 owner (small, but touches the approved door surface — note in the live record either way) |

## Next task

**In order:**

1. **AE1.3 owner:** fix the 11 named TS2322 in `users/actions.ts` → `typecheck` exit 0; commit
   the doors set (migrations + tests + vectors + rules file + ADR-0161 companions), **flipping
   `ENFORCE_PERSON_AUTHORITY_DOORS` in `scripts/check-memberships-door.mjs` in the SAME
   change** (gate obligation — the doors are now in the catalog on every reset). Then the
   **contiguous window**: `reset → 384–388 green → 15-case mutation audit → door sweep →
   ARM=census green`. ⚠ The door sweep MUTATES; one owner, announce resets.
2. **AE1.5 owner:** the 30 stale-verdict sweeps + the write-path arm over the 22 cases (its
   exit-0-over-empty-set defect is filed; report in words, never as an exit code).
3. **RV0 partition owner:** the catalog is quiet — run it.
4. The small amended close conditions: the ONE `user_id` index (+pgTAP) · ADP global-form +
   probes · tiered-review columns over the 752 classification · flake fingerprints · the
   `TO public` ruling · R2 HMAC deny test.
5. Then: full `test:db` re-confirm, `e2e:prod`, QA review, Record step (rotation + budget
   line + C1a queue re-check + delete this handoff in the Record commit).

## Re-derivation appendix

```bash
# tree + remote
git log --oneline f121c031..HEAD; git status --short
git rev-list --count origin/authz-ae1-hardening..HEAD

# db head + registry closure (must be equal; 481 at this update)
docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc \
  "select max(version), count(*) from supabase_migrations.schema_migrations;"
ls supabase/migrations/*.sql | wc -l

# the 11 typecheck errors (should shrink to 0, never grow)
npm run typecheck 2>&1 | grep -cE "error TS"

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
