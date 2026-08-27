---
branch: authz-ae1-hardening
task: AE1 — integrity and privilege hardening (authz evolution)
adrs: [0155, 0160, 0161, 0162, 0079, 0133, 0152, 0156]
base_sha: 120478bf
created: 2026-08-27
updated: 2026-08-27
status: live
---

# Handoff — AE1 (authz evolution, ADR 0155 D9)

## ▶ RESUME HERE

1. `git log --oneline f121c031..HEAD && git status --short`
2. `docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc "select max(version), count(*) from supabase_migrations.schema_migrations;"` — expect `20261003005000 | 481` unless someone migrated after this update.
3. Read **PROGRESS.md § Now**, then **[authz-ae1.md](../progress/authz-ae1.md)** — that file, not this one, is AE1's live record: the task table, the **AMENDED close conditions** (plan audit → ADR 0162), and the FUP obligations.
4. `npm run typecheck` and `npm run lint` — **both expected exit 0** at `120478bf`. Anything else is new.

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

Everything below was measured on **this** tree by the session that wrote it, on a quiet stack.

| What | Witness |
| --- | --- |
| AE0 · AE1.1 FKs · AE1.6 zero-policy · AE1.4 registry · AE1.2 classification | unchanged from earlier: `0b499417` · `14ad668d` · `91455fbd` · `800ffe2a` · `f4df4f5f` |
| The 11 `.rpc()` rulings; minutes latch `…005000` + pgTAP 388 | `90b188fd` / `2448a655` |
| **AE1.3 COMPLETE** — 6 doors + predicate, `callDoor` type seam (R7), gate flipped ON | `63230a84`; `typecheck` **0** (was 11 TS2322) |
| **AE1.3 gate record** — 16 cases / 16 `KEYSTONE HOLDS` / FINDINGS 0; sweep ERROR ruled | `7793142b` |
| **Close #4** — the ONE `user_id` index; PA-F15's cascade premise measured FALSE | `2d8b7c24`; pgTAP 383 `plan(10)` |
| **Close #2 + #6** — ADP global `FOR ROLE`; all 11 `TO public` policies normalized | `9bd06670`; pgTAP 389 `plan(9)`, 382 `plan(71)` |
| **AE1.5 increment landed + its harness snapshot verified** (33/33 worklist rows match the catalog; tripwire proven still able to fire) | `40e5c893` |
| **Close #5** — flake fingerprints, owner, expiry; the FUP's `.focus()` lead corrected | `4915cd3a` |
| **Privilege budget** — ceiling **752** + merge rule | `5be4c9c8`; `backend-state.md` § Privilege budget |
| **THE 63-CASE SWEEP RE-RUN + MERGE** — read 41 swept / 40 COVERED / **0 BLIND** / 1 ERROR; write 13 COVERED. 54 of 63 measured; **BLIND 74→69, COVERED 296→316** | `120478bf` |
| Four ARM arms, post-merge, exit codes read directly | census **0** (565 gates / 601 verdicts) · wrapper **0** (BLIND 41) · hat **0** · floor **0** |
| **`e2e:prod` GATE GREEN** — 1249 passed · 0 failed · 3 flaky · 11 skipped · 21 batches; accounted **1263/1263** on the final batch lines | `120478bf`; 17:28→18:37 UTC |
| `test:db` · `lint` · `typecheck` · vitest | **237 files / 7,870 PASS exit 0** · **10/10 exit 0** · **0** · 144 / 1,964 exit 0 |
| Registry closure | `max(version)=20261003005300`, **484 registered == 484 on disk** |

### Not started / still owed

- ⛔ **Close condition #3's TIERED THREAT REVIEW — sized, not done, and it is NOT a small item.**
  Tier 1 = **432** functions (`config.toml` exposes `public`+`graphql_public`; `app` is not),
  Tier 2 = 320, and the population holds **384** command doors. PA-F11 asks ten threat columns
  per Tier 1 row **plus individual justification for every public command door**. Its bounded
  half (budget ceiling + merge rule) IS done. ⚠ The failure mode to avoid is a shallow pass that
  fills 432 rows thinly and reports #3 as met. Needs a scoped run or a PO narrowing.
- **RV0 revoke partition** (`docs/design/authz-ae1-revoke-partition.md`, uncommitted). All **233**
  revokes remain HELD; AE1 executes none.
- **`FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST`** (R2, a condition of the `complete_minutes_job` ruling).
- AE1.5's **AFTER capture** (the `EXPLAIN` re-baseline for the wrapped tables).
- The RV3 experiment (§ Open questions).
- **QA review · Record step** — the only §6 gate steps left. (`e2e:prod` is DONE and GREEN;
  see § Gates. ⚠ It surfaced a THIRD flake, filed as `FUP-E2E-PROF-CREATE-ROSTER-FLAKE` and
  deliberately not admitted to the named baseline — disposition undecided.)
- ⚠ At Record: rotate PROGRESS.md (85 KB vs the 82 KB target), re-derive
  `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`'s counts (never increment by hand), re-check C1a still heads
  the ▶ queue (rule G10), and file the FUP obligations table in `authz-ae1.md`.

### Tree

HEAD **`120478bf`**, **13 unpushed**, working tree otherwise clean except three untracked items:
`docs/design/authz-ae1-revoke-partition.md` (RV0's, not started) and — pre-existing, **not this
program's, leave them** — `docs/learning/` and `scripts/progress-cleanup-2026-08-26.mjs`.

⚠ Other sessions have committed to this branch historically; they were paused for this stretch and
the DB was owned throughout. **The successor inherits DB ownership.**

## Gates

All measured on the `120478bf` tree, quiet stack, fresh reset. Exit codes read **directly**.

| Arm / suite | Result | Exit |
| --- | --- | ---: |
| `test:db` | **237 files / 7,870 — PASS** | **0** |
| `lint` (10 gates) | OK (⚠ PROGRESS.md 85 KB > 82 KB target — rotate at Record) | **0** |
| `typecheck` | OK | **0** |
| vitest | 144 files / 1,964 | **0** |
| `ARM=census` | INVARIANT HOLDS — **565 live gates enumerated**, 601 verdicts | **0** |
| `FROMFINDINGS=1 ARM=wrapper` | INVARIANT HOLDS — BLIND 41, all allowlisted | **0** |
| `ARM=hat` | INVARIANT HOLDS — self-test 6/6, 3 reasoned-allowlisted | **0** |
| `ARM=floor` | INVARIANT HOLDS | **0** |
| `e2e:prod` (full, batched, reset per batch) | **GATE GREEN** — 1249 passed, 0 failed, 3 flaky, 11 skipped | **0** |
| diff-scoped sweep, **read** arm, 63 cases | SWEPT 41 · COVERED 40 · **BLIND 0** · ERROR 1 | 1 |
| diff-scoped sweep, **write** arm | COVERED 13 · BLIND 0 · ERROR 0 · SKIPPED 0 | 0 |

**AE1's gate line, in words and never as an exit code:** *63 cases derived over 9 migrations · **54
measured** · **9 UNMEASURED BY EITHER ARM**, named in `authz-ae1.md` · 0 BLIND among everything
measured · 1 ERROR, ruled and covered by the targeted mutation audit.*

⛔ **Domain qualifier, always stated beside "all arms green" (plan rule 2):** the reachable command
doors of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2) are outside **every** arm's domain until that FUP
closes. Counts re-derived at Record, never quoted.

⛔ **Two exit codes that must not be read as coverage.**
1. The **write arm exits 0 even having measured nothing** — its summary is `(COVERED = the rest)`
   with no selection count. What told this run apart from the one that measured NOTHING is that it
   emitted **13 verdicts**. Count verdicts, never the exit code.
2. The read arm's **exit 1** here is `DIRTY — 0 BLIND, 1 ERROR`, and the ERROR is the known
   `app.can_administer_person_for` neutralization limit, ruled and merged. **0 BLIND is the number
   that matters.**

**Did NOT run:** QA review · the full ~5 h door sweep · the RV3
experiment · AE1.5's AFTER capture.

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
| Does Postgres re-check EXECUTE inside a stored CHECK expression at write time? (5 fns, 8 constraints) | RV3 — one rolled-back txn, throwaway `BYPASSRLS` role. Gates future revokes; does **not** bind the current 233 |
| ✅ **ANSWERED (R7, `63230a84`)** — neither: both options were wrong. See § State. | — |

## Next task

AE1.3 and AE1.5 are both closed out; the sweep is re-measured and merged. What remains, in order:

1. **Close condition #3's tiered threat review** — ⛔ **scope it or have the PO narrow it FIRST.**
   It is a security review over **432** Tier 1 functions with ten threat columns each, plus
   individual justification for **384** command doors. Filing a thin pass would make the phase
   record claim a threat review happened. Its bounded half is already done.
2. **RV0 revoke partition** — SQL is ready in `docs/design/authz-ae1-revoke-partition.md`
   (uncommitted); the catalog is quiet. ⛔ AE1 executes **no** revoke: all 233 stay HELD. Binding
   ruling: *a revoke may not create sweep blindness* — revoking `authenticated` EXECUTE removes a
   function from `ARM=floor`'s domain.
3. **`FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST`** (R2) and **AE1.5's AFTER capture**.
4. ✅ **`e2e:prod` DONE — GATE GREEN** (1249 passed, 0 failed, 3 flaky, 11 skipped; accounted
   1263/1263 on the final batch lines). ⭐ It is also what proved the six AE1.3 doors over the
   **wire** — pgTAP calls them in SQL and the vitest fixture mocks the client, so nothing had
   exercised `callDoor`'s explicit `null`s through supabase-js until this run.
   ⚠ **Three flakes, and the composition matters:** M2 matched its fingerprint exactly; M1's was a
   labelled GUESS and is now corrected from measurement (`:168`, not `:160`); a **third**
   (`ethics-e4-participants.spec.ts:765`) is NEW and was deliberately **not** admitted to the
   baseline → `FUP-E2E-PROF-CREATE-ROSTER-FLAKE` (filed: body + index line).
   ⭐⭐ Both survivors fail on the **same** mechanism — a Radix `menuitem` absent inside the
   `"abrir menu da conta"` dropdown — which is the one-root-cause the FUP predicted but **not**
   the `.focus()` class it named.
5. **QA review → Record step — the only gate steps left.** ⚠ At Record, FIRST: **rotate
   PROGRESS.md — now 86,778 bytes vs the 81,920 target** (hard cap 102,400, ~15.6 KB left).
   This session deliberately did NOT rotate: rotation is a Record-step activity needing full
   context, and a botched one at handoff time is worse than being over target. Also:
   re-derive C2's counts, re-check C1a still heads the ▶ queue, file `authz-ae1.md`'s FUP
   obligations table as real index lines + bodies, and **delete this handoff in the Record commit**.

⛔ **If you run any mutation harness:** one owner, announce it, freeze the tree under
`supabase/tests/**` (the sweep's baseline is the suite SHAPE, so a new file invalidates a run as
surely as touching the DB), and **never kill it** — a killed sweep skips its EXIT-trap restore and
leaves a gate wide open (`.claude/rules/mutation-harnesses-are-not-killable.md`).

⚠ **Land suite-shape changes BEFORE sweeping, not after.** This session sequenced close conditions
#2/#6 ahead of the 63-case run for exactly that reason; doing it the other way stales the verdicts
you just paid an hour for.

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
