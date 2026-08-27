---
branch: authz-ae1-hardening
task: AE1 — integrity and privilege hardening (authz evolution) — ✅ COMPLETE, unpushed
adrs: [0155, 0160, 0161, 0162, 0079, 0133, 0152, 0156]
created: 2026-08-27
updated: 2026-08-27 (Record step)
status: complete — awaiting merge + push
---

# Handoff — AE1 ✅ COMPLETE (authz evolution, ADR 0155 D9)

## ▶ RESUME HERE

**AE1 is recorded and closed.** This file is now a *merge-and-what-next* artifact, not a
work-in-progress one.

1. Measure, never read (`.claude/rules/live-facts-measure-dont-quote.md`):
   ```bash
   git rev-parse --short HEAD; git rev-list --count origin/authz-ae1-hardening..HEAD; git status --short
   docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc \
     "select max(version), count(*) from supabase_migrations.schema_migrations;"
   ls supabase/migrations/*.sql | wc -l   # must equal that count
   ```
2. Read **PROGRESS.md § Now**, then [authz-ae1.md](../progress/authz-ae1.md) — the phase's full
   record, including every operational lesson it paid for.
3. The phase row is in [phase-ledger.md](../progress/phase-ledger.md); QA rounds 1 + 2 are in
   [authz-ae1-review.md](../reviews/authz-ae1-review.md).

## What AE1 delivered

Six tasks, six close conditions, two QA rounds, full §6 gate.

| | |
| --- | --- |
| **AE1.1** | both `commission_administrativos` FKs `ON DELETE CASCADE` + the ONE `user_id` index (PA-F15's cascade premise measured FALSE for both columns) |
| **AE1.2** | 752 DEFINERs classified · the **tiered threat review** over **523** Tier-1 rows (⛔ not 432) · **233 revokes classified, NONE executed** · RV0 partition (**23 HOLD**) · RV3 answered |
| **AE1.3** | six person-authority doors + the `can_administer_person_for` predicate · **16/16 keystones** mutation-proven at full shape |
| **AE1.4** | service-role DML registry at **44 sites**, machine-diffed by the new **eleventh** lint gate |
| **AE1.5** | initplan wrap over 52 policies / 29 tables; `costs off` shape diff ruled the acceptance evidence |
| **AE1.6** | 7 zero-policy tables, door-only, now with a **set-closure** assertion so an eighth cannot enter silently |

## ⛔ Next, in order

1. **Merge + push.** ⛔ **SCHEMA FIRST, THEN CODE** — `.claude/rules/push-schema-before-code.md`;
   the AFF4 Record step recorded a violation of exactly this. Nine migrations
   (`…004600`–`…005300`).
2. **AE2 is next, and is BLOCKED on a PO ruling before any migration is written** — AE2.0, the
   offboarded-person lifecycle authority question (0151 D10), which needs its own ADR. The plan is
   explicit: *"No migration is written before it."*
3. ⚠ **C1a still heads the ▶ queue** (rule G10, re-checked at this Record step). AE1 did not
   displace it, and neither may AE2.

## What AE1 leaves behind — all filed, none forgotten

`FUP-AE1-REVOKE-SET-EXECUTION` (the 233, and ⛔ **137 of them are a silent no-op as written**) ·
`FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY` (31 doors) · `FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED`
(~25 tables, a Rule 11 question for the PO) · `FUP-AE1-UNREACHABLE-PUBLIC-DOORS` ·
`FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST` · `FUP-REACTIVATE-USER-HAS-NO-DENY-ARM` ·
`FUP-MUTATION-AUDIT-BLIND-TO-THE-DOOR-WRAPPERS` · `FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE` ·
`FUP-E2E-PROF-CREATE-ROSTER-FLAKE`. `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` was filed **and resolved**
the same day.

## Facts that still bind — measured, not remembered

- ⛔ **This DB has NO planner statistics** (`reltuples = -1`). Never `ANALYZE` before comparing
  against the AE0 baselines; a cost-only diff is autovacuum, not a finding.
- ⛔ **`IN_SCOPE` from the service-role census is NOT a site count.** `callDoor()` is a free
  function and the census sees only member `.rpc()` calls, so one placeholder stands in for five
  real door calls. `lint:service-role-registry` does the expansion; quote **44**, never the raw 40.
- ⛔ **A `REVOKE … FROM authenticated` is a no-op for anything reaching the role via `PUBLIC`** —
  137 of the 233. Probe `has_function_privilege` after every batch; an unmoved predicate is a
  failure, not idempotence. And **RV3 = YES**: revoking EXECUTE on a constraint-referenced
  function breaks writes to the constrained table.
- **C2 (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`) re-derived at this Record step: 426**, not 407 — 344
  `public` (still inside `ARM=floor`) + 82 `app` (in no client-reachability-bounded arm).
  ⛔ Re-derive by property; never increment.
- `npm run lint` is **ELEVEN** gates. PROGRESS.md is ~84 KB against an 82 KB target — 10.2 KB was
  rotated at this Record step and what remains is live by the three-way test.

## ⛔ The four instrument failures this phase paid for — the reason to distrust a green

Each reported success while measuring nothing, and each was caught by something *other* than
reading the code:

1. A mandated gate harness **exited 0 having measured an empty set** (`p0-authz-writepath-audit.sh`).
2. A `regexp_matches` context probe read **`m[0]`** — NULL for every match — and reported "no
   matches" on bodies full of them, **agreeing with the expectation being tested**.
3. A **day-old log file** was read as this run's verdict; it was byte-identical to the real one, and
   only the exit code disagreeing caught it. `> file` truncates only when the command runs.
4. The AE1.3 mutation audit could not tell **FAIL from ABORT**, so two suite aborts counted as
   keystones holding.

⭐ And twice in one afternoon a *fix* carried the same defect as the thing it fixed: an allowlist
marker that named the statement's **subject** instead of the property that **justified** it, and a
fixture sweep keyed on a **function name** instead of the property *"a bare door call whose success
a later assertion presupposes"* — which found four of eight. **Both produced a green that looked
like the right one, and only re-running the instrument showed the gap.**

## Re-derivation appendix

```bash
# gates — capture exit codes DIRECTLY, never through a pipe
npm run test:db      # expect 237 files / 7,871
npm run lint         # ELEVEN gates
npm run typecheck; npm run test

# the four ARM arms — run from the repo root with ABSOLUTE paths (a relative `cd` that
# fails leaves a STALE log that still says INVARIANT HOLDS)
for a in census hat floor; do ARM=$a bash supabase/tests/mutation/p0-authz-invariant.sh; echo "$a=$?"; done
FROMFINDINGS=1 ARM=wrapper bash supabase/tests/mutation/p0-authz-invariant.sh; echo "wrapper=$?"

# the phase's own instruments
docker exec -i supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -f - < scripts/authz-tier1-threat-review-ae1.sql
node scripts/check-service-role-registry.mjs
bash supabase/tests/mutation/ae13-person-doors-mutation-audit.sh   # ⛔ NEVER kill it
```

⛔ **Catalog is truth** for every schema/RLS/RPC claim — never a migration file, never graphify.
**One exception, learned here:** *attribution*. "Which migration edited this policy" is the one
question the catalog cannot answer and the phase's own migration file can.
