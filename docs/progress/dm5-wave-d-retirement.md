# DM5 — Wave D + retirement (phase record)

> Live status lives in **PROGRESS.md**; this file is the authority for DM5's detail.
> Rotated out of PROGRESS.md mid-phase (2026-08-14) because the live file had reached
> **128 KB against CLAUDE.md §7's "well under 60 KB"** target — and every teammate spawn
> reads it. Plan: [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md) ·
> ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) · step 0:
> [dm5-surface-verification.md](./dm5-surface-verification.md).

## 🔵 S4 — legacy bucket retirement (2026-08-16) — **PO-authorized on the day**, per §11's gate

**Authorization:** the PO authorized S4 explicitly on 2026-08-16, separately from S3's approval, after
being shown the eight buckets, the survivors, and that the run is **local-only** (the no-push directive
stands). The parked **FUP-DM5-D11** ruling was deferred in the same exchange — *decide later*, and
nothing in S4 depends on it.

**Delivered:** migration **`20260927000400_dm5_s4_retire_legacy_buckets.sql`** (drops the last 4
retirement-bucket policies + the 8 bucket rows, behind an executable byte-first guard) · pgTAP **`325`
5 → 8** (t6/t7 retirement pins + **t8**, the survivor positive control) · successor assertions in
**`200`**, **`142`**, **`143`**, **`341`** · dead bucket constants removed from
`src/lib/attachments/constants.ts`. Surface delta: the **DM5·S4** block at the head of
[backend-state.md](../backend-state.md).

### ⭐ The finding that defines S4: the byte half was a NO-OP, and the records must say so

Measured at S4 start, before touching anything: **`storage.objects` = 0 rows across all 12 buckets**
while the volume held **866 files / 9.9 MB / 235 PHI-tier**. For the 8 retirement buckets that is
**221 files / 6.93 MB / 15 PHI-tier** — reproducing S0's recorded figure **exactly**, independently.

**Every one of those bytes is already an orphan with no metadata row, so the Storage API — the D9
GATE — cannot address a single one.** A `capture` yields an empty manifest and a `delete` deletes
nothing. This is not a defect in the tool; it is the tool's own `DEGENERATE BASELINE` verdict firing
exactly as S0 designed it to.

⛔ **So S4 completed the METADATA/SCHEMA half and did NOT perform the byte half locally — it could
not.** Recorded as such, never as "retirement proven". What *is* proven: the bucket rows and doors are
gone, and they **stay** gone across `db reset`, which is the half that six historical migrations would
otherwise silently undo. The deploy-time byte path remains D9's manifest-first sequence, and it is
meaningful **there** because production *has* metadata rows (census 2026-08-11: 45 objects).

> ### ⛔⛔ CORRECTED 2026-08-17 by QA (S4 review B1) — the 221 files are GONE, and they did not go through the gate
>
> The sentence that stood here ("the 221 local orphans stay with FUP-DM5-STORAGE-ORPHANS") was **false
> from about an hour after I wrote the measurement it rests on.** Re-measured independently, twice:
> `docker volume inspect` → `CreatedAt 2026-08-17T01:06:02Z` (**the volume was destroyed and
> recreated**); `walk` → *"(no directory on the volume)"* ×8, `TOTAL files=78`, all survivors;
> `capture` → `orphan_keys=0`, **`CAPTURE CLEAN`** — against a committed manifest from 10 minutes
> earlier recording **221 / 6,927,804 bytes / 15 PHI**.
>
> **I destroyed them.** Recovering a wedged stack — after I killed a mid-flight `supabase db reset` and
> hit a container-name conflict — I ran **`supabase stop` + `supabase start`**, and the volume was
> recreated at exactly `01:06:02Z`. `supabase stop` reported `"backup":true` while doing it. ⚠ Which
> step did it is **not established, and I invent no mechanism** — but it sits inside my recovery
> sequence and nothing else in the window fits (E2E run 2 started `01:09Z`, after).
>
> **Three things follow, and the third is the one that generalises:**
> 1. **It was a disposal without evidence — 221 files, 15 PHI-tier — inside the slice that ratified
>    D9.** No manifest at disposal time, no count comparison, no audit. *"The byte half was a no-op"*
>    is only half true: **the bytes went; they just didn't go through the gate.**
>    → **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** (filed).
> 2. **The PO ruling ("leave them, keep the FUP open") was MOOT when given** — 3h11m after its subject
>    ceased to exist — because I briefed it from my own 00:55Z measurement instead of re-measuring at
>    decision time. Outcome unchanged; the PO was still asked to rule on a fiction. ⭐ **A decision
>    brief needs a measurement taken at decision time, not the one that motivated the question.**
> 3. ⭐ **Nothing alarmed.** It surfaced only because a reviewer refused to inherit a figure I had
>    carried forward for three hours. The whole of this phase's discipline is "don't inherit claims" —
>    and the claim I failed to re-check was **my own**, which is the one that never looks like an
>    inheritance.
>
> #### ✅ RE-PUT AND RULED 2026-08-17 — B1's remaining requirement, discharged
>
> Point 2 above named the failure; this is it corrected in practice. The question was re-put to the PO
> **after** re-measuring, on a freshly-rebooted stack following a clean `db reset`:
>
> | scope | files | bytes |
> | --- | --- | --- |
> | the **8 retired** buckets | **0** | 0 |
> | the **4 surviving** buckets | **166** *(at 03:45Z — see below)* | 2,970,290 |
>
> ⛔ **The survivor row is a timestamped observation, not a count, and it went stale within the session**
> (QA r2 INFO-5): **245 files / 4,394,074 B** after the gate. ⛔ **A second claim here — that it "moved
> again half an hour later with nothing writing" — was WRONG (QA r3 MINOR-11):** that was
> `du -sb /mnt` vs `du -sb /mnt/stub/stub`, two 4 KiB wrapper inodes apart, **a scope difference read as
> a time series** ([[a-predicate-quoted-at-the-wrong-grain]]). Both figures reproduce simultaneously.
> **State the method beside any byte figure** — `du -sb` (allocated) and `stat -c %s` (apparent) differ
> by 1.94 MB here. The real, measured drift is **166 → 245 across the gate**, and it is enough:
> ⭐ **which is exactly why the PO ratified a CLASS, not a number** —
> every gate run writes bytes and every reset orphans them. The retired buckets' **0** is the durable
> half; nothing writes to a bucket that does not exist. **Quote the mechanism, never refresh the figure.**
>
> **PO ruling: the local volume is ratified as non-durable, disposable test residue** — no cleanup step,
> no gate, no local manifest discipline. Two live alternatives were declined: clearing the volume inside
> `db reset` (changes shared tooling every session depends on, and destroys evidence a future incident
> may need) and applying full manifest discipline to the 166 (right discipline, wrong scope).
>
> ⭐ **And re-measuring did not merely refresh the numbers — it changed the question.** The 166 are not
> retirement residue; they are ordinary E2E/print artifacts that **the reset orphaned as it ran**. Local
> orphan accumulation is therefore a **standing byproduct of `db reset` on any stack that has written
> bytes**, not an S4 artifact — D17's correcting insight, now measured rather than argued. Had I re-put
> the question on the 221-file framing, the PO would have ruled a *second* time on a state that no
> longer existed. **The retirement-scope orphan question closes empty by measurement**; the `01:06:02Z`
> destruction stays charged to FUP-DM5-STACK-CYCLE-DESTROYS-BYTES, undischarged, and the deploy-time
> byte path remains **UNREHEARSED**.

### Gate step 1

Fresh `supabase db reset` (announced; single-owner stack) · registry **407 == 407** · pgTAP
**193 files / 6351 PASS** (S3's 6348 + the 3 new `325` pins) · tsc **0** · lint **5/5** · vitest
**1294** (unchanged — the removed TS had no test, which is *why* it was removable) · four arms
**ALL HOLD**, exit codes captured unpiped: census live **546** / verdicts **570** (identical to S3's
close — S4 added no gate, so no census entry is owed) · hat **3** reasoned-allowlisted, self-test 6/6 ·
floor allowlisted · `FROMFINDINGS=1` wrapper BLIND **41** ⊆ allowlist · degenerate bodies **0**.

**Diff-scoped `ARM=policy`: NOT APPLICABLE, and recorded as that rather than as clean.** S4's diff
**drops** 4 policies and adds/modifies none, and touches **no** `prosecdef` body — so the sweep's
domain is empty. *A dropped policy has no gate to open.* (S3 recorded the same distinction; per its
precedent, "not applicable" must never be written up as "clean".)

### The four dead gate attempts, and the environment lessons they cost (~3 h, one habit)

*Copied here at step-5 rotation from PROGRESS.md, which was their only durable home — the handoff §12
also carries them, but the handoff dies with DM5 and these outlive it. Not summarized: copied.*

Before the run below, **four attempts produced zero usable figures and — the fact that matters —
not one assertion failure in any of them:**

| attempt | result | cause |
| --- | --- | --- |
| tester's full gate | 46 "failures" in batch 17, 28 unrun | **resource exhaustion** — `0xC0000142 STATUS_DLL_INIT_FAILED`, workers never initialised, **zero assertions ran** |
| lead isolation #1 | 134 UNRUN | launched into a stack still restarting **+ the tester's gate process tree still alive** |
| lead isolation #2 | 66 UNRUN | same concurrent gate, still alive |
| lead full gate | died mid-batch-1, `EXIT=1`, no error output | abrupt termination, unexplained — **no mechanism invented for it** |

⭐ **All three lead attempts were self-inflicted and share ONE habit: trusting a status report instead
of measuring the thing.** The harness reported the tester's task *"completed"*; its `npm run e2e:prod`
tree was **still running**, holding `:3000` and resetting the DB under two later runs — the
single-owner rule the lead had quoted into both agents' briefs, then broken twice in twenty minutes.
**`TaskStop` does not reap the gate's process tree. Verify with `Get-Process`, never from the
notification.**

⚠ **Two more breakages of the same class:** piping `supabase db reset` through `grep | head`
**SIGPIPE-killed the reset mid-flight** (the "never pipe a gate through `head`/`tail`" rule applies to
resets too — redirect, then grep the file); and `storage.buckets does not exist` was read **three
times** as a corrupt database when it was a race against the post-reset container restart —
**after a reset, poll for readiness before querying.**

**pgTAP at that stop point: 193 files / 5900, `FAIL` — and NOT a regression.** 17 suites reported
`Bad plan … ran 0` with `deadlock detected` at `test_helpers.bootstrap()`, and **`Failed: 0` on every
one.** That is **HANDOFF-1**, the documented intermittent `pg_prove` worker deadlock, at unusual scale
(17 files vs the recorded 2) on a machine hammered all night. ⭐ **Every one of these was a machine or
process condition; none was code — a reboot cleared all of them**, and the run below is the proof.
⚠ *"Nothing failed" and "nothing ran" are different facts.*

### ✅ Gate step 2 — `e2e:prod` — **ESTABLISHED 2026-08-17. GATE GREEN, and the figure is RESTATED at 1121.**

> ✅ **RE-RUN AND RESTATED 2026-08-17 on a freshly-rebooted machine.** The 1118 figure was suspended
> because it predated the R15 fix (`140ffd8c`) and therefore **counted a vacuous security pin among its
> passes**, and because four attempts since had produced no usable figure — resource exhaustion
> (`0xC0000142`, workers never initialised), two runs invalidated by a **concurrent gate process the
> lead failed to reap**, and one unexplained abrupt exit. **None of the four produced a single
> assertion failure.** The suspension is now discharged by measurement, not by argument.
>
> ⭐ **The handoff's diagnosis was right and is now confirmed, not assumed:** the machine, not the
> code. Uptime **0.0 h** at the start of this run; the same suite that had been unrunnable four times
> completed **18/18 batches** with 0 failed and 0 did-not-run, and the pgTAP deadlock storm
> (17 suites, `Bad plan … ran 0`) likewise vanished — **193 / 6351 PASS, 0 deadlocks.**
>
> ⚠ **Kept rather than deleted:** the reconciliation *method* below was always correct, and the
> structural defect this section recorded — a heading reading **GATE GREEN** while the same file said
> "do not quote 1118", the S2 reopen-banner defect repeating *in the file documenting it* — is why the
> heading is now edited **in the same commit** as the figure it reports.

**1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches**, `next build`
compiled, **2 infra re-runs** (batches 6 and 11, both classified `server_dead`/`conn_errors` and both
clean on re-run). Gotenberg verified **200** on :3010 before the run — without it 15 print specs fail
as uniform pt-BR errors that read exactly like product defects.

**The accounting reconciles, and the summary line again needed checking to see it.** The gate prints
`COVERAGE: accounted for 1123 of 1129` — **6 short**, the shape
[[gate-summary-can-hide-unrun-tests]] warns about. Resolved identically to S4: the per-batch lines sum
to **1129 / 1129 accounted, with 0 did-not-run in every one of the 18 batches**; the summary's
"accounted" simply excludes skips. Verified by re-summing the per-batch lines independently of the
summary: `passed 1121 · flaky 2 · skipped 6 · did-not-run 0`, and 1121 + 2 + 6 = **1129**.

| run | passed | flaky | skipped | collected |
| --- | --- | --- | --- | --- |
| S3 (2026-08-14) | 1120 | 3 | 6 | **1129** |
| ~~S4 (2026-08-16)~~ *superseded* | ~~1118~~ | ~~5~~ | ~~6~~ | ~~**1129**~~ |
| **S4 re-run (2026-08-17)** | **1121** | **2** | **6** | **1129** |

⭐ **The restatement reconciles to the suspended figure exactly, which is the point of restating rather
than replacing.** Collected is **unchanged at 1129** across all three runs, and skips are unchanged at
6 — so the +3 against S4 is precisely the **three tests that were flaky then and are clean passes now**
(5 flaky → 2). **The R15 rewrite was one test replaced by one test**, which is why the collected total
did not move despite the spec growing 176 lines. Had collected moved, that would have needed its own
explanation before this figure could be quoted.

**Three claims verified individually, not inferred from the aggregate**, bounded by the 18 log paths
**the runner itself named** (`(log: …)`) rather than by a glob — `/tmp/e2e-prod-gate/` still holds
stale logs from the previous session's dead attempts, including a `batch-29.log` from an 18-batch run
and the **old vacuous R15 at `:650`**, and a glob sweep silently mixes them in:

- `pdf-printing` **9/9** and `pdf-printing-meetings` **6/6** — the print corridor still mints real
  `%PDF-` bytes with `printed-documents` deleted. **This is the check S4 owed most**, now independently
  re-confirmed after the retirement migration.
- **Zero `not ok` lines** across all 18 authoritative logs.
- **R15 appears only as the new test** (`phase14c-rca.spec.ts:736` — *"the object survives the
  attempt"*). The retired `:650` pin appears **nowhere** in this run. B2's fix is therefore proven to
  have *executed*, not merely to have been committed.

**Identical collected total and identical skip count** — the only movement is **two tests shifting
from `passed` to `flaky`** (failed once, passed on retry). That is flakiness, not regression: 0 failed,
0 did-not-run. The 3 unique skips are conditional and unrelated to storage (`phi-remediation` REM-8/9,
`user-registration` AC2 invite-mode). The 5 flaky are keyboard/timing shapes
(`act-role-assumption`, `bulk-case-creation` kbd grid, `phase2-auth-shell` logout, `ff3-validations`,
`dm5-nsp-evidence` EVID-KBD-1).

⭐ **The check worth doing, because S4 deleted the bucket S3's corridor was proven against:**
`pdf-printing` **9/9** and `pdf-printing-meetings` **6/6** — identical to S3 — with **zero** non-ok in
any print / document / evidence spec. **The print corridor still mints real `%PDF-` bytes after
`printed-documents` was deleted**, which is independent confirmation that S3's re-pointing onto the
core substrate is real rather than merely asserted.

### 🔒 The defect S4 nearly shipped to the REMOTE: `SET LOCAL` in a migration is not guaranteed to be in a transaction

The first version of `…000400` copied `20260921000300`'s idiom verbatim — a bare
`set local storage.allow_delete_query = 'true'` followed by the `DELETE`. It passed a standalone
`supabase db reset`, pgTAP, all four arms and the catalog check: **4 bucket rows, exactly right.**

Then the E2E gate's own reset printed this against that very file:

```
Applying migration 20260927000400_dm5_s4_retire_legacy_buckets.sql...
WARNING (25P01): SET LOCAL can only be used in transaction blocks
```

**`SET LOCAL` outside a transaction is a silent no-op**, so in that path the platform opt-in was never
set. And the opt-in is genuinely load-bearing — probed directly, in a rolled-back transaction:

| probe | result |
| --- | --- |
| `delete from storage.buckets` **without** the opt-in | **`ERROR 42501: Direct deletion from storage tables is not allowed`** — `storage.protect_delete()` |
| the same delete with `set_config(..., is_local => true)` **inside a `do` block** | `deleted=1`, clean rollback |

**Fixed** by moving the opt-in and the `DELETE` into **one `do` block**: a `do` block always executes
inside a transaction (its own, if none is open), so the local setting is guaranteed to be in scope for
the delete beside it and to die with it. Re-verified: the migration now applies with **no warning**,
registry **407 == 407**, 4 bucket rows, pgTAP **193f/6351**, four arms HOLD.

⭐ **Why this was worth stopping a running E2E gate for.** The bug is invisible wherever the runner
happens to wrap the file, and `db push` to the remote is a *different* invocation from
`supabase db reset`. A green local gate would have certified a migration whose destructive step is
conditional on an undocumented property of the tool that applies it. **The fix removes the dependency
rather than betting on it.**

> ### ⛔ CORRECTED 2026-08-17 by QA (S4 review) — two claims above are WRONG. The fix stands; my causal story did not.
>
> 1. **"The E2E gate's reset" framing is false — it is NOT path-specific.** A plain
>    `npx supabase db reset --local` emits **six** `25P01` warnings, one from `20260921000300` itself.
>    My standalone reset *did* emit them; I had read it with `tail -25`, which cut them off, and then
>    wrote up the difference between the two paths as a finding. ⭐ **I turned my own truncated read
>    into a mechanism.**
> 2. **My "the opt-in is load-bearing" probe was taken at the WRONG GRAIN** — and it is the probe I
>    leaned on hardest. It ran against the **post-reset live DB**, where `protect_delete` genuinely
>    raises `42501`. That is not *migration-apply time*. QA's surviving hypothesis, stated as a
>    hypothesis: the trigger **is not in force while migrations apply**, because `storage.migrations`
>    row 55 (`prevent-direct-deletes`) re-executes during the reset. That resolves what I had recorded
>    as unexplained — the DELETE succeeded because nothing was stopping it, not because the opt-in
>    somehow took.
>
> **What survives unchanged:** the `do`-block form is correct and transaction-safe, QA re-proved the
> guard refuses (by inserting an object into a resurrected bucket), and the fix removes the dependency
> on the runner's transaction handling either way. ⭐ *"The guard refuses" and "the guard refuses **at
> apply time**" are different claims; my probe answered only the first.*
> → [[a-predicate-quoted-at-the-wrong-grain]], a third instance this phase.

⚠ **`20260921000300` still carries the original `set local` idiom** and has the same latent
fragility; it is applied history and was left alone. → **FUP-DM5-SETLOCAL-MIGRATION** (filed).

### Five ways this slice tried to go wrong — all of them the phase's own recurring classes

1. ⭐ **My reference sweep was bounded by ONE property and the breakage lived in another.** I swept
   for *reads of `storage.buckets`* and for *`storage.objects` inserts*, proved exactly one breakage
   (`200:405`), and shipped it — then pgTAP returned **4 reds** in `142`/`143`/`341`, every one an
   assertion that the **policies I was dropping still EXIST**. Two properties; I enumerated one.
   [[enumeration-boundary-is-a-syntax-not-a-property]] again — *the sweep ran, it just wasn't
   sweeping the thing.*
2. ⭐⭐ **The five broken assertions failed in OPPOSITE directions, and only one direction announces
   itself.** Three went **RED** (`want 2, have 0`). Two — `142`'s and `143`'s *"NO update/delete
   policy"* Rule 6 pins — went **VACUOUS**: zero policies satisfies them forever, silently, and they
   sat in the "passing" column of a green suite. **The red ones were the lucky ones.** Both kinds were
   replaced; had I fixed only what the suite reported, S4 would have left two dead pins reading as
   coverage. Same shape at `200:405`, where `is(NULL, false)` **failed** only because pgTAP treats a
   NULL result as failure — written as a zero-count it would have flipped silently green too.
3. ⭐ **I nearly shipped a vacuity while fixing a vacuity.** `341`'s F9 pins BUG-DM5-CAPA-1 and was
   keyed to the retired policy's NAME, so it went NULL — a name-keyed verdict does not follow its
   subject ([[a-rename-orphans-a-name-keyed-verdict]]). I re-keyed it to `app.can_write_document`'s
   live capa arm via `prosrc like '%can_write_capa%'` — **but that body's own header COMMENT names
   `can_write_capa` in prose**, so the bare-name form is satisfied by the comment and would survive
   deletion of the actual call. Tightened to the CALL form `app.can_write_capa(`, then **proved** it:
   neutralizing the call in a rolled-back txn gives `bare_name = t` (the vacuity, demonstrated) and
   `call_form = f` (falsifiable). Same fix and proof for `142`'s twin. md5 of `can_write_document`
   **identical** before and after; degenerate bodies **0**.
   → [[a-comment-is-an-assertion-that-goes-stale-silently]], now as a *test's* blind spot.
4. ⚠ **Two tooling traps that each read like a real result.** (a) `ARM=census` reported
   **INVARIANT VIOLATED**, flagging `public.type_owner_is` / `view_owner_is` — **pgTAP's own
   functions**, from an extension I had installed by hand to run a single suite. Dropping pgtap
   cleared it. (b) The `exit=$?` I printed beside it was **`tail`'s** status, not the script's —
   the exact `| tail` masking that once hid an exit 2. All four arms were re-run unpiped, to files.
   → [[a-detector-that-finds-a-lot-needs-proving-too]], [[mutation-harness-must-prove-its-rollback-first]].

### One lead error, recorded because the near-miss was a committed artifact

`storage-manifest.mjs capture` takes **`--out`**; **`--manifest`** is `delete`'s flag. I passed
`--manifest`, and the capture silently wrote to the **default committed path**, overwriting S0's
baseline. `git status` caught it and it was restored with `git checkout`. ⭐ **The accident was also a
free verification:** the diff showed the retirement-bucket figures **byte-identical** to S0's, with
only the timestamp and the core-bucket census moving — an independent reproduction of the
221/6.93 MB/15 PHI claim. *An unknown flag that falls back to a default destination is a footgun; the
tool should reject unknown flags.* → **FUP-DM5-MANIFEST-FLAG** (filed).

### NOT TESTED / NOT COVERED (binding heading — a close that omits it reads as completeness)

- **The byte deletion path was never EXECUTED against a populated bucket** in S4. `delete --execute`
  was not run at all, because the manifest was empty by construction. Its correctness rests on S0's
  self-test (8/8, including a manufactured orphan and a deliberate count mismatch), **not** on an S4
  run. **The production sequence is therefore still unrehearsed end-to-end.** ✅ **OWNED 2026-08-17 —
  PO directed the rehearsal into S5 as `S5.R`** ([plan](../plans/dm5-wave-d-retirement-plan.md) § S5.R),
  scoped to the **with-metadata** path on a purpose-made disposable bucket, since the eight retired ones
  now return `BUCKET_ABSENT` (QA r1 MINOR-5). ⚠ **This bullet does not move until S5.R runs** — an owner
  is not a rehearsal, and it stays under this binding heading precisely so a reader cannot mistake the
  two.
- **Nothing remote was touched**, verified or otherwise. FUP-DM5-STORAGE-ORPHANS' Cloud half stays
  residual.
- ⛔ **The 221 local orphan files were DESTROYED, outside the gate, by my own stack recovery** — see the
  corrected block above. They were never "left in place"; the PO ruling that said so was moot when
  given. FUP-DM5-STORAGE-ORPHANS stays OPEN, but its centre of gravity has moved to the Cloud question
  (no customer-accessible tool may be able to SEE an orphan; the S3-protocol endpoint is still
  UNPROBED). New: **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**.
- ⚠ **"Four ARMs HOLD" is TRUE and is ZERO COVERAGE of this diff** (QA INFO-3).
  `p0-authz-invariant.sh:295` bounds the census at `nspname = 'public'`, so the four dropped
  `storage.objects` policies were **never in any arm's domain**. I reported the arms in a way that
  implies they exercised something here; they did not. The real coverage for this diff is pgTAP `325`
  t6/t7/t8 plus the successor assertions — *the arms are orthogonal to it.*
  ⭐ **A standing gate that passes is not a gate that looked.**
- `235`/`236` still **create** `case-documents` / `interview-attachments` bucket rows inside their own
  rolled-back transactions. Left deliberately: they are self-sufficient, `u1-mutation-audit.sh` runs
  inside `236`'s transaction, and rewriting an authz fixture to chase a cosmetic is the riskier change.
  ⚠ But it means those suites now assert against buckets that exist **only inside the test**.
- ⚠ The Supabase CLI offered **v2.114.0** (pinned/installed **v2.105.0**). **Not taken.** D17's remote
  half was grep-verified against the v2.105.0 binary; a bump must re-run that grep.
  → [[remote-reset-storage-orphan-is-cli-version-dependent]].

## ✅ S3 — printed renditions onto the substrate: **COMPLETE, all four gate steps (2026-08-14)**

> **This is the current head of the phase.** Full narrative, the six enumeration-boundary repeats, the two
> corrected true-sounding claims, S3's record, and S4's authorization gate live in
> **[dm5-handoff.md](./dm5-handoff.md) §§9–11** — written for a session that was not here. Not duplicated
> here on purpose: two copies of a status is how this phase produced eight record defects.

**Delivered** (all ancestors of HEAD `1513c094`): `6ffd92ff` `859faa18` `d964b61a` `e08cf4eb` `af9a894e`
(backend) + `02b2218d` (tester). 6 migrations `20260927000300`–`000350`, pgTAP **`342`** (59), fixtures
rewritten in `312`/`313`/`323`. **`frontend` was never spawned** — every TS signature stayed stable and D18
removed the only new surface, so S3 needed no UI.

**Gate, lead-verified from the catalog:** registry **406 == 406** · pgTAP **193 files / 6348 PASS** · tsc 0 ·
lint **5/5** · vitest **1294** · `ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` **all HOLD** ·
diff sweep **BLIND 0 · ERROR 0** · degenerate bodies **0** · findings **595** · `e2e:prod` **1120 passed ·
0 failed · 0 did-not-run · 3 flaky · 18 batches**, `next build` compiled.

⭐ **The corridor was executed** — `pdf-printing` 9/9, `pdf-printing-meetings` 6/6, real `%PDF-` bytes,
mint → download → verify → revoke → overlay → re-verify. **S2 passed every static gate while its feature did
not work at all; S3 has been run.** ⚠ Requires the **Gotenberg sidecar** on :3010 and `--workers=1` against
`next dev` — see the handoff's environment section.

🔒 **One live bug found and fixed: BUG-DM5-S3-INACTIVE-PRINT-1** — a deactivated user kept print-download
authority. Closed by D12's conjunction. **No authz ARM can see that class** → FUP-DM5-SIBLING-GUARD-DIFF.

**Lead-verified from the catalog, not accepted from any report** (moved here at the S3-closure rotation —
these are **current facts**, and the byte-for-byte archive lower down is marked *superseded*, so they must
not live only there): `securable_resources_type_check` admits **9** types · `app.resolve_document_version_bytes`
exists and **`authenticated` cannot EXECUTE it** · the print arm is present in **both** kernel doors ·
`printed_documents.storage_path` is **dropped** · all six teammate commits are **ancestors of HEAD**.

**Still open after S3, and NOT to be assumed** — ⚠ **an `APPROVED` slice is not an absence of gaps**, and
r2 restated this as its own "not re-verified" list: `case`/`interview` prints **UNTESTED because
unmintable** (`can_view_printed_document` has arms for `form_response`/`meeting` only — **D6 is satisfied at
the *type* level**; two of four kinds have never produced a print) · `add_referral_shared_item` never driven
end-to-end · a print's `file_objects.sha256` is the **minter's** hash, not `finalize_document_upload`'s
derivation, **and it feeds `complete_document_disposal`'s duplicate-evidence probe** · the smoke file is
**not gate-resident** (`grep -n smoke package.json` → no hits) · `ARM=policy` was **not applicable** to this
diff (it adds `prosecdef` gates, no RLS policy) — recorded as *not applicable*, **never as clean**.

⚠ **D18, corrected after implementation:** the detail half's filter landed on `queries/documents.ts`'s
`getDocument`, which **no route imports**; the reachable same-named export in
`queries/controlled-documents.ts` selects `from('controlled_documents')`, so prints are excluded
**structurally, by the schema, not by D18**. `form_response` prints have **no panel to leak into at all**
(`DocumentHomeResourceType` excludes them) and **6 of 9** local prints are that kind — so the exclusion is
untestable there for want of a *surface*, not for want of a test. (ADR 0120 D18 amendment;
FUP-DM5-DEAD-CORE-PROJECTION.)

### ✅ Step 3 — QA **APPROVED (r2)**, 2026-08-14 (`801a2589`, [review](../reviews/dm5-s3-review.md))

r1 = **CHANGES REQUESTED** (0 P0 · 2 MAJOR blocking · 6 MINOR · 2 INFO) → all discharged at `af9a894e` →
**r2 = APPROVED**. New at r2: **0 P0 · 0 MAJOR · 1 MINOR · 3 INFO**, all record-level.

⭐ **What makes this r2 worth more than a second reading: it re-proved every blocking item by
neutralization.** With guard 4 deleted from the *live* body (`guard4_still_present=false` printed before the
suite ran), the new **`S3k2` went RED — `caught: no exception / wanted: P0002` — while `S3f4` stayed
GREEN.** That is MAJOR-1's exact complaint, now discriminating. `S3d2`'s vacuity was reproduced
**side-by-side on the same mutated body**: `pos_active=0`, old form `t`, new form `f`.

⭐ **r2 declined to inherit the lead's own correction.** The lead had overturned r1's MAJOR-2 premise; r2
re-derived it from the retired CHECK and the same migration's column grants, then **applied the declined
`REVOKE` in-transaction** and showed the `home_resource_id`-only walk yields the coordinate **before and
after** — effective, and closing nothing. It also proved red-first the two assertions `backend` had not
(`t51c`/`t51d`). ⚠ One r2 claim rests on **migration text** (a retired CHECK's definition) and says so;
sound only because a CHECK is not among the things this repo rewrites at runtime.

**Safety record:** fresh reset first · **8 mutation-bearing runs, every one a single rolled-back
transaction**, each prefix refusing to run as a no-op · degenerate bodies **0** after every run ·
`md5(pg_get_functiondef)` byte-identical on all five mutated functions, `begin_document_upload` =
`aedac0b01f2ad0a594b75eede6671fb0`, **the same md5 r1 recorded** · `prosecdef=true` on all five · column
ACLs restored · `storage.objects` back to **8** policies, 0 probe policies · registry 406==406 · `pgtap`
dropped. **Lead-verified independently after the agent stood down**, because the standing rule is that a
mutation harness proves its own rollback (this stack has been left with a gate OPEN before).

**Lead-closed r2's one stated gap.** r2 wrote that it had **not** re-run `ARM=census` and that
`…000360` *does* rewrite a `prosecdef = t` body — accepting step 1 as reported. Since **`ARM=census` is
precisely the arm that catches a gate you just added**, the lead re-ran all four at `801a2589`:
**census** live **546** / verdicts **570** · **hat** 3 reasoned-allowlisted (self-test 6/6) · **floor**
74 never-called, allowlisted · **`FROMFINDINGS=1` wrapper** BLIND 41 ⊆ allowlist — **all HOLD**, exit 0,
output never piped (`| tail` once masked an exit 2 as 0).

### ✅ Step 4 — PO, 2026-08-14

Instruction: *"run the QA and conclude S3."* Approval **delegated in advance, contingent on an APPROVED
r2** — had r2 reddened, this looped to step 1 rather than closing. Recorded this way, not as a review of
the evidence, because the PO gave it **before** the verdict existed.

⛔ **This is a SLICE verdict.** DM5's phase QA is still owed at **S6**, and r2 **authorizes no part of
S4** — S4 deletes storage objects irreversibly and needs PO authorization **on the day**.

## ✅ RESUME AUDIT before S3 (lead, 2026-08-14, HEAD `e2af9790`) — the build is sound; **every defect was in the RECORDS**

The PO asked for a consistency check on the DM5 work before continuing. **Nothing in the built system was
wrong.** Every figure the handoff claimed reproduced exactly on a fresh reset — registry **399 == 399** ·
pgTAP **192 files / 6284** · tsc **0** · lint **5/5** · vitest **1294** · all four arms **HOLD** (census
546/569 · hat 3 · floor 74 · wrapper BLIND 41) · degenerate bodies **0** · tree clean · findings 594 lines.
The catalog corroborated every S2 claim independently: 8 securable types, **both** kernel doors carrying
`rca`+`capa_action` with `prosecdef = t`, `p_storage_path` dead on all three write doors, `wave_d` asserted
at `begin` and deliberately not at `finalize`, `tenant_shape` carrying D14's shape-B, flags default `false`
in migration and ON in the local seed only. **S2's one owed item — the four arms — is discharged.**

⭐ **The finding is the shape of the finding.** A phase that spent six weeks learning *"text is not truth"*
had produced, in its own status files, **eight** assertions that contradicted the catalog, git, or each
other. **A build verified nine ways was being described by records nobody re-ran.**

| # | inconsistency | disposition |
| --- | --- | --- |
| **1** | 🔴 **PROGRESS.md asserted `⛔⛔ S2 IS REOPENED — IT WAS NEVER FUNCTIONAL` as CURRENT STATE.** All three named defects are ✅ FIXED — contradicted by the **same file's own bug log**, by git, by 0 stub bodies, and by the live catalog. **This is the file every teammate spawn reads**: a `backend` spawned for S3 would have been briefed that S2 is broken. | ✅ rewritten; the lesson retained, explicitly re-framed as **history** |
| **2** | 🔴 **PROGRESS.md's phase-status DM row said "No migrations/code written yet"** and quoted registry **391**. Eight migrations are registered; it is **399**. | ✅ corrected, with a pointer to the live section as the authority |
| **3** | 🟠 **The "S2 … CLOSE" section here presented the VOID first close's figures** (397 / 6272 / 1264 / "6 migrations") **with no visible marker** — the reopen banner sits ~200 lines above under a different heading. ⭐ **This is ADR 0120's own withdrawal root-cause #3 repeating one file over:** *a supersession marker only a raw-file reader can see is not a marker* — and here it was worse, because the marker was merely **distant** rather than hidden. | ✅ loud in-section banner + the true figures beside the void ones |
| **4** | 🟠 **`docs/backend-state.md` predates EVERY S2 migration** (last content `bf1585ea`) — no knowledge of the new types, either kernel arm, the dead `p_storage_path`, the `wave_d` assert, or the un-parked citation seam. ⛔ **This is the same file, in the same phase, that caused S1's withdrawal — and it would now have been consulted by S3, which touches exactly that surface. Third strike attempted.** | ✅ loud currency stamp at the head enumerating all 8 migrations' deltas; full rewrite stays an S6 deliverable |
| **5** | 🆕 **The S3 trap-3 enumeration was bounded by two line numbers, not by the property** — **four** sites, two unnamed anywhere, one of them S2's own new code. And the recorded failure mode was wrong: it does not crash, it **silently misclassifies a fully-uploaded print as `pending` with `canOpen: false`**, forever. Full analysis + per-site reachability: handoff §4 trap 3. | ✅ corrected and sharpened; **reframed from "frontend's" to a joint resolution-seam fix + keystone** |
| **6** | 🟡 **Two 🔴 follow-ups were in `follow-ups.md` but had ZERO mentions in PROGRESS.md** — FUP-AUTHZ-HARNESS-TRANSACTIONAL (a **live authz-harness hazard**) and FUP-DM5-FINALIZE-ATOMIC — against the stated "filed in BOTH" discipline. | ✅ both now in PROGRESS.md's Open list |
| **7** | 🟡 **Two items lived only in handoff prose, filed nowhere:** `330` is BLIND to `can_write_document`, and the intermittent `pg_prove` worker deadlock (*will re-red a gate at random and read like a defect*). | ✅ named in PROGRESS.md as explicitly unfiled |
| **8** | 🟡 **PROGRESS.md is 137 KB** against §7's "well under 60 KB" — it was rotated to 115 KB at `3b51c20d` and grew **22 KB in one slice**. Rotation is the lead's, and [[progress-md-record-step-rotation-is-chronically-skipped]] is a standing memory. | 🔶 **OPEN** — flagged to the PO, not yet done |

⚠ **The one class this audit could NOT clear.** Every check above is static — catalog, git, counts, text.
**S2's own history is that all of those were green while the feature did not work at all**, because *not one
of them executes a page*. The E2E evidence for S2 is a **quick-loop** run (8/8 new + 36/36 pre-existing),
never `e2e:prod`. **DM5 has no full-gate E2E result at any point**, and it must not close without one.

## ⚠ INCIDENT during S2 verification — an authz gate was LIVE-OPEN on the shared stack (2026-08-14)

**Anyone auditing S2's results needs this window.** `app.can_write_document` — the gate for **every**
document write across all eight home types — sat live with the body `begin return true; end` (an
**unconditional allow**) on the shared local stack, for an interval whose only lower bound is a
`pg_get_functiondef` capture at **17:28**. ⚠ **`pg_proc` carries no mtime**, so the window cannot be
dated from the catalog; **any document-write-path result produced in it must be RE-RUN, not re-read.**

**Cause: a LEAD instruction.** I told a backend teammate to *"neutralize `can_write_document` and
confirm your keystone block goes red"* **without saying transactionally**, on a stack two other
teammates were live on. Not a product defect — the migration `20260927000160` is correct and its own
self-verifying `DO` block passed at apply time. Full analysis + the structural fix:
**FUP-AUTHZ-HARNESS-TRANSACTIONAL** in [follow-ups-open.md](./follow-ups-open.md).

**Caught by `tester`, which verified its environment BEFORE executing an agreed plan** — everything it
was about to run would have gone **green while proving nothing**, a false all-clear on the exact defect
class this slice exists to close. It also **declined to hand-patch** the function despite having the
correct body in front of it, because a second actor was mid-run.

**Resolution, verified independently by three parties** (backend-assurance's differential, the lead's
catalog sweep, `tester`'s own re-probe — each measured rather than relayed):
`degenerate_bodies 0 · has_rca_arm t · has_capa_arm t · still_neutralized f · prosecdef t`, and
`chefe.farm` → `begin_document_upload('rca', …)` → **REFUSED P0002**.

⭐ **Blast radius was bounded by a PROPERTY query, not a name list** — sweep `app`+`public` for any body
matching `^\s*begin\s+return\s+(true|false)\s*;\s*end`. **Exactly one hit.** ⚠ A left-open gate is
**invisible to all four §6 authz arms**, because they test doors that *exist*; that query is the only
thing that sees it.
⭐ **The rollback was PROVEN before being relied on** — md5 of `pg_get_functiondef` before, gate replaced
in-txn, probe, `rollback`, re-read: byte-identical, same md5. Postgres DDL is transactional, so a
rolled-back `CREATE OR REPLACE` leaves no residue — now measured, not assumed
([[mutation-harness-must-prove-its-rollback-first]]).

## ⭐ A deliberately uninformative error code is uninformative to the TEST too (S2 `341` F-block)

ADR 0120 D-note: `add_rca_evidence`'s citation arm raises **`HC0D8` for both absence and
unreadability, deliberately**, so a caller cannot use the error to probe which documents exist — an
error code that distinguishes *"not found"* from *"not yours"* is an **existence oracle**. That
design decision is correct and stays.

⚠ **But the same ambiguity that blinds an attacker blinds the assertion.** Three fixture defects in
the F-block, each caught by a red, each a different class — and the middle one is the specimen:

1. **A hardcoded id captured before the reset.** The seed mints document ids with
   `gen_random_uuid()`, so the captured id named nothing afterwards. F4/F6 went **visibly red** —
   **but F7 stayed GREEN for the wrong reason**: it asserts `HC0D8` and received `HC0D8` from *"no
   such document"* rather than *"you may not read it"*. A vacuous pass hiding inside the assertion
   its author was most confident about.
2. **The fixture was RLS-filtered by the caller.** Resolving the id inline read `public.documents`,
   gated by `can_read_document`, which returned **no rows** for the very writer who cannot read it —
   so `p_cited_entity_id` arrived NULL and the **shape** check fired (`23514`) *before* the
   authorization gate could. F7 would have been asserting **the fixture vanishing**, not the door
   working. Fixed by resolving as `postgres` into a temp table (not RLS-filtered).
3. **The temp table needed an explicit grant** — probes run as `authenticated`, `postgres` owns it.

**The rule this yields:**

> When a door answers **one code for several causes** — by design, to avoid an oracle — a test
> asserting that code proves **nothing about which cause fired**. The discriminating fact must be
> established **separately, before the assertion runs**.

`F5b` now pins both sides first: the document **exists**, `chefe.ccih` **can** read it, `nspcoord.a`
**cannot** — so F7's `HC0D8` can only mean unreadability. ⚠ **Two of the three defects would have
left a GREEN suite asserting nothing**, which is [[FUP-PGTAP-VACUOUS]] in its natural habitat:
`lint:vacuous` scans TS only, and every one of these is SQL.

`341`'s `D4d` was also converted from a substring ACL test to `aclexplode`, and **`D4e` added for the
direction a presence check structurally cannot see** (`grantee = 0` is PUBLIC) — the same habit that
produced a false positive *and* a vacuous guard across three migrations, now removed from the suite
as well as the migrations.

Suite `341`: **plan(41), 41 assertions** (30 → 41); repo total **192 files / 6272** (6261 → 6272).
Both deltas are **+11** — stated with the reconciliation because a bare "41" beside a "+11" reads as
a discrepancy, and this phase has already mis-recorded three counts.

## ⭐ The finding that justifies the whole "inference until reset" discipline (S2 `…000150`, 2026-08-14)

**A fresh `supabase db reset` did not confirm the hand-applied `REVOKE` — it FALSIFIED the migration
file.** `…000120`'s PUBLIC-grant assertion **had never executed**: it was added while repairing an
already-registered migration, so only the hand-applied `REVOKE` ever took effect, and the corrected
file first ran at the reset — where it **fired on every function and broke the reset**.

⚠ **The lead had checked that the file and the live DB agreed, and they did.** Had that been recorded
as fact rather than as an inference, a **broken migration would have carried into the gate with a
green local stack agreeing with it**. The rule, in the words that matter:

> **"File and DB agree" is NOT "the file works."** A migration that has never executed is unproven no
> matter how exactly the database matches what it claims to do.

**One habit, two OPPOSITE failures — the sharper half.** The assertions asked a *string* a question
only *structure* can answer:

| migration | test | failure |
| --- | --- | --- |
| `…000120` | `acl like '%=X/postgres%'` | **false positive on everything** — PUBLIC is an aclitem with an **empty grantee**, so the pattern also matches `postgres=X/postgres` |
| `…000130`, `…000150` | `and not like '%postgres=X/postgres%'` | **vacuous** — structurally incapable of firing while `postgres` holds a grant |

Fixed with `aclexplode(...) where grantee = 0`. **Third instance of this class in one slice** — the
first was `prosrc like '%HC0DM%'` matching the author's own **comment**. `prosrc` includes comments;
an ACL is not a string. Related: [[a-comment-is-an-assertion-that-goes-stale-silently]].

⚠ **The near-miss is part of the finding.** The first diagnosis blamed
`information_schema.column_privileges`, which was *plausible* — the column genuinely showed 0 rows —
but only because **the failed reset never created it**. *A symptom observed in a broken end-state is
not evidence about the cause.* Reproducing against the real pre-state gave the true error in one step.

**Verified after the fix** (lead, independently): `anon_exec = f` and `public_holds_exec = f`
(via `aclexplode`) on both doors, and **0 first-party `public` functions anon-executable** — the
population assertion, not just the two touched.

🔧 **Residual, benign, tracked:** `…000110:181` still uses
`if v_acl not like '%authenticated=X/postgres%'`. That is a **presence** check, so it fails **loud**
(false alarm, never false pass) — not worth re-opening a landed migration, but convert it when that
file is next touched. *The habit is the defect, even where this instance is safe.*

**Also durable, and better than the design it replaces:** `328` **K9b now asserts the OFF flag set is
EMPTY** rather than naming a flag, so it cannot go stale the next time a wave ships. The K9b/K9c
coupling exists to force flag choreography to be an explicit reviewed edit; this makes it survive
its own success.

### 🔵 IN PROGRESS — **DM5: Wave D + retirement** (opened 2026-08-14) — the program's FINAL phase

> **Plan:** [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md) ·
> **ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D10, PO-ruled
> 2026-08-14 before any SQL) · **step 0:** [dm5-surface-verification.md](../progress/dm5-surface-verification.md)
> (`005fe34d`). Window `20260927000100`+ · pgTAP **`341`** · flag `documents_wave_d`.
>
> **Step 0 found two hard blockers the parent plan did not know about**, both re-verified by the
> lead directly against the catalog before rulings were taken:
> ① **`securable_resources` admits only 6 types** and its `tenant_shape` CHECK **re-enumerates the
> same list**, so widening one CHECK alone fails every insert closed — Wave D evidence and
> form-response prints have no home. ② **`UNIQUE (document_version_id, rendition_kind)`** permits one
> `printed_pdf` per version, against `printed_documents_one_active`'s *partial* unique retaining many
> historical prints. Plus **six places the plan describes a system that does not exist** — the
> manifest is **8 buckets not 9**, the verification-token "satellite" is not a table, and
> `rca_evidence`'s parked FK is **triple-locked**, not single.
>
> **PO rulings 2026-08-14 (ADR 0120):** **R1** three new securable types (`rca`, `capa_action`,
> `form_response`), commission pinned to **reporting** with custody staying a read-time input ·
> **R3** all four `source_kind` values migrate, so the manifest closes at 8/8. ⛔ **R2 and R4 were
> RE-RULED the same day and are WITHDRAWN — see below.**
>
> ⛔ **ADR 0120 D3/D4/D5 WITHDRAWN 2026-08-14, never built; D11 replaces them.** Printed renditions
> follow the **existing new-version idiom** — each print mints a `document_version`, binds its bytes
> as that version's `printed_pdf`, records supersession on `printed_documents`, retires superseded
> bytes via `file_objects.disposal_state`. **`document_version_files` is not touched**: no liveness
> column, no partial unique, no guard exception, **no DM1-invariant amendment**. **S1 is withdrawn
> as a slice**; its window is released to S2.
>
> **Why — four facts, each verified live before the re-ruling.** ⭐ **DM2 had already evaluated and
> rejected D3+D4 BY NAME** (`dm2-orchestration-wave-a.md:253-281`: *"Option 2 (partial UNIQUE +
> liveness column + guard exception) remains strictly worse: an invariant edit for no additional
> honesty"*) · **S2.8 was never parked** — ruled, **built** (`20260924000500`), ADR'd at 0118 and
> keystoned at `329` R6/R7/R8, shipped as `reclassify_document` + `complete_document_reclassification`
> · `app.guard_document_version_immutable()` is **SHARED with `document_versions`**, so D4's
> "narrow exception" reached the table ADR 0114 **D10** protects with *"never a pointer update
> (F-03)"* · the "incompatible cardinality" compared **two keys that never meet**
> (`(document_version_id, rendition_kind)` is per-**version**; `(source_kind, source_id,
> template_key)` is per-**source**) — an artifact of the lead's framing, on an unrecorded
> many-prints-to-one-version assumption.
>
> ⛔ **Root cause, and it has now misled TWICE:** `docs/backend-state.md:245-246` said *"Still
> unbuilt: S2.8 … no legal expression"* — written at DM2 S2 close, never updated when S2.8 landed
> **hours later**. DM3's planner hit it and **caught** it; DM5's lead hit it and **did not**, and it
> produced an ADR decision. ⭐ The verdict was keyed to the **noun** `reclassify_document_file` —
> genuinely absent from `pg_proc` — while the **capability** was live under another name. *Resolve
> the VALUE, not the noun.* Corrected in the same change. **Nothing was built on D3–D5**; the cost
> was one planning cycle, because the check happened before SQL.
>
> **Lead ruling, not a PO question:** the parent plan's retirement method — "prove empty via the
> Storage API, then delete" — is **WITHDRAWN**. It proves emptiness against `storage.objects`, which
> a reset truncates while the bytes survive: measured **0 metadata rows vs 699 objects / 7.0 MB, 198
> PHI-tier**, `list` returning `[]` for all 12 buckets. Replaced by **manifest-first deletion**
> (capture keys → delete by key → assert `deleted_count == manifest_count`). ⚠ **Calibration:** the
> orphans are **not servable** (every read path resolves metadata first) — this is a data-at-rest /
> disposal-assertion problem, not a live exposure. Closes the method half of **FUP-DM5-STORAGE-ORPHANS**.
>
> ⚠ **The assurance plan is WORSE than DM4's.** Every door DM5 adds sits in a census blind class, so
> all four §6 arms pass **regardless of what is built** — bespoke keystones + mutation twins are
> mandatory, and the record names the **arm**, not the script. Red-first is genuinely hard here: a
> keystone against the un-parked `add_rca_evidence` **goes green on its first run**, satisfied by a
> *sibling* lock (the table CHECK). **FUP-PGTAP-VACUOUS applies directly** — `lint:vacuous` does not
> scan SQL and every DM5 keystone is SQL.
>
> **Later rulings 2026-08-14 — D12 (PO) + D13 (lead), both gating S3.** **D12:** printed bytes are
> served by **composition** — `open_printed_document` keeps `can_view_printed_document`, the
> revoked/superseded overlay and the token path, and **delegates byte resolution to the core door**.
> Forced by two facts: `open_document_version` hardcodes `rendition_kind = 'source'` (so a
> print-only version is unopenable through it) and `file_objects` may only live in the two document
> buckets, which carry **no SELECT policy** because ADR 0114 **D8** reserves them for *"the **single**
> audited door … (the F-01 class dies structurally)"*. ⚠ The shared resolver must be **`app`-scoped,
> never `public`**, authority the **conjunction**, and **both** refusal directions keystoned.
> **D13:** a print mints its version on its **OWN `documents` row**, never appended to a content
> document — else `add_referral_shared_item`, which picks latest-version-desc, would silently
> **freeze a printed PDF into a referral snapshot instead of the source content**. Invisible to every
> static gate; keystone the separation itself.
>
> ✅ **S2.8's three DM2 conditions re-verified as ALL DISCHARGED** (by behaviour, not by name —
> because withdrawing D5 on an unverified completion would have been the same error twice). Condition
> 1 was **exceeded**: QA r1 found R6/R7/R8 all stayed green under a `live` relaxation that kills the
> invariant for two simultaneously-pending duplicates, so R10a/R10s pin the exact
> `disposal_state = 'none'` spelling. Nothing from S2.8 becomes a DM5 item.
>
> **Slices:** **S0 ✅ COMPLETE** (`0e85cbe7`, `9d37ad79`) — `scripts/storage-manifest.mjs`, **8/8
> self-test controls**, baseline for the 8 buckets, `document-reconciliation.mjs` widened 2→**12**.
> ⭐ **C8 was added unprompted and is the discipline generalizing**: C2 proved the tool *refuses* a
> bad manifest, but *a tool hardwired to refuse everything passes C2 and is useless* — C8 is the
> permissive twin. That is the both-polarities rule applied to the harness itself.
> ⭐ **Three of the eight controls found real defects**: `find` on a *missing* directory emits the same
> empty output as an *empty* one, so an absent bucket read as verified-empty (now `—` vs `0` vs `?`);
> `storage.protect_delete()` **blocks `storage.objects` DML on this stack** — a platform guard
> absent from the step-0 model, so the harness plants bytes directly; and C8 was the missing
> permissive half. ⚠ The committed baseline
> **self-labels DEGENERATE** (zero API-visible keys while bytes exist = the post-reset state) and
> **must not be reused as S4 input**. Orphan counts, domains stated because they differ: **221 keys /
> 6.93 MB / 15 PHI** over the 8 retirement buckets; **699 / 7.02 MB / 198 PHI** over all 12.
> ~~S1 substrate amendment~~ ⛔ **WITHDRAWN** · **S2 🔵 IN PROGRESS** · S3 printed renditions
> (D11/D12/D13; **no longer blocked**) · S4 retirement execution · S5 operational closure · S6 canon + sweep.
>
> **S2 progress (2026-08-14).** Contract posted **first** (`fec8a84f`) + amendment 1 (`6a3fbf2a`);
> `frontend` spawned against it and building in parallel. **M1 applied** (`e386505f`), types
> regenerated (`ca0b5ab5`, after the reset and **before** `test:db` installs `pgtap` — that
> pollution has bitten this repo). Verified **against the applied migration, not the file text**:
> registry **392 == 392** · both CHECKs carry `rca` + `capa_action` · `tenant_shape` carries **both
> shapes** · `rca` registry commission = `event.reporting_commission_id` (D2) · `capa_action`
> commission **NULL** (D14) · `hospital_of_capa_action` non-NULL (D16) · composite FKs present ·
> **pgTAP 191f/6231 PASS — the DM4 baseline exactly, zero regressions.**
> ⭐ **The D1 coupling is PROVEN, not assumed:** with only `type_check` widened, a **fully tenanted**
> `rca` row is still rejected `23514` — fully tenanted *deliberately*, so the rejection can only come
> from `tenant_shape`'s type list; a minimally-tenanted fixture would have proven nothing. All three
> `tenant_shape` cases were shown to **discriminate before** being written as keystones.
> **`capa_action.commission_id` is left NULL for EVERY row**, including the four sources where it is
> derivable — *a half-populated column invites a future reader to treat it as authoritative*, so the
> NULL is a deliberate signal rather than an absence.
>
> **M2 `…000110` applied** (`5fd60ff1`) — `can_read_document` kernel arms, custody-following.
> registry **393 == 393** · `rca` arm resolves `can_read_event(event_of_rca(…))` at read time and a
> catalog assertion pins that it does **NOT** use the registry commission · `capa_action` arm names
> `can_read_capa` **explicitly** (it *would* fail closed reaching for the D14 NULL commission, but
> fail-closed-by-accident is not a design) · pgTAP **191f/6231 unchanged**. Applied with
> `migration up --local`, not a reset — non-destructive, `frontend` undisturbed.
> ⭐ **Building the fixture BEFORE the keystone found two things a keystone-first order would have
> hidden.** ① **The seed has no custody-moved event** — all five carry
> `current_owner_commission_id` NULL — so **that arm of `can_read_event` has never been exercised by
> any test in this repo**. A pre-existing coverage gap DM5 merely tripped over; `341` now pins it.
> ② **A raw `UPDATE` cannot create the state** (`guard_event_status()` refuses edits past `triado`),
> so a keystone written first would have failed **at fixture time and read as a defect in the arm
> rather than in the fixture**. The differential runs through the real `transfer_event_custody` RPC,
> which is also the more honest test — it proves the arm under the transition the product performs.
> ⭐ **The persona was checked against all three arms, not assumed:** `multi@test.local` (both
> commissions) and `pqsdual.a@test.local` (PQS of the hospital) would each have turned the
> differential green while proving nothing — the two-locks shape. `staff1.farm` verified as *not*
> PQS, *not* in the reporting commission, *in* the owner commission ⇒ only custody can make it true.
> ⭐ **Technique to repeat in S3:** the `CREATE OR REPLACE` rebuild was **proven faithful by diffing
> the rebuilt `pg_get_functiondef` against the captured original** (diff = exactly the 15 new arm
> lines + 3 comments), plus a `DO` block re-asserting `prosecdef` / `STABLE` / the `search_path` pin
> / the `authenticated` EXECUTE grant **from the catalog**. *Reading a body carefully is not the same
> as proving you reproduced it* — this converts the silent-property-loss class
> ([[guards-that-read-right-but-fail-open]]) into a loud failure at apply time.
>
> **S2 frontend ✅ COMPLETE** (`5793fd16`) — 13 files, +1129/−476. `openUrl` is gone, so rows render
> **no `<a href>` at all**: there is no storage coordinate left in the projection to link to, and bytes
> resolve one at a time through the audited door strictly on click (D8). `canOpen` is obeyed verbatim,
> never re-derived — it decides what to **draw**, the door decides what to **serve** (Rule 1).
> Contract amendment 1 landed *before* ship, so the `terminal` heuristic was **deleted, never
> shipped**; `credential.expiresAt` pre-empts a lapsed reservation so "expired" never reads as
> "broken" at the 120 s PHI TTL. Gates: tsc 0 · lint **5/5**, eslint 0 warnings · vitest 1264/1264.
> **Fork ledger** (recorded so the duplication reads as *chosen*, not accumulated): reused outright —
> `DocumentAvailabilityBadge`, `AVAILABILITY_PRESENTATION`, the MIME/size constants,
> `uploadDocumentFile`; forked deliberately — the open-button **shell** (~25 lines: its contract is
> *"every Wave-A byte moves through THIS control"*, so injecting a different door would falsify the
> one sentence that makes it meaningful) and the upload dialog (Wave-A's carries kind /
> confidentiality / occurredOn that NSP evidence has none of; only the **transport choreography** is
> genuinely shared). `CapaEvidenceList` / `RcaEvidencePanel` were **NOT** forked — re-pointed.
> ⭐ **`unavailable` handled by NARROWING THE REFERENCE, not widening the type:** the
> `DocumentAvailability` import is deleted, the badge map is keyed
> `Exclude<NspEvidenceAvailability,'available'>`, and the `unavailable` **badge entry is deleted** so
> no dead branch can render — the word survives only in the error map, where `HC0D8` genuinely is
> reachable (servable at render, gone by the click). A green typecheck would have been satisfied by
> *either* resolution; only asking which one distinguishes them.
> ⚠ **Runtime-unverified by design** — every action/query signature still throws
> `not implemented — DM5 S2`, so both pages 500 on the list queries until backend lands the bodies.
> Expected under contract-first; **`tester` must not read it as a frontend red.**
> 🔧 **History repair:** `e1557179` shipped with a mangled message (PowerShell here-string in the
> Bash tool — the commit *succeeds*, only the message is wrong, so nothing fails loudly). Frontend
> **correctly refused to `--amend`**: the lead had committed on top, so the reflex fix would have
> rewritten the LEAD's commit — the exact documented failure mode, and the prohibition earned its
> keep. Lead rewrote both commits via safety-branch + `reset --soft` + separate restage;
> **tree hash `abbe887c…` identical on both sides**, verified independently by frontend afterwards.
>
> **Two lead errors this slice, both recorded because they are the same class as the phase's other
> findings.** ① I told backend the upload ticket lacked `expiresAt`; it was at
> `evidence-contract.ts:202` all along — **my grep pattern never contained the term**, so I reported
> an absence from a search that could not have found it. ② My S2 task brief told `frontend` the new
> availability states were `pending/failed/disposed/unavailable`; there are **three** new states and
> `unavailable` is not among them. ⭐ Rule drawn: *the search that proves an absence must NAME the
> thing* — quotable is not the same as capable. Same family as `\yname\y` failing before `_` and the
> `.rpc('X')` sweep that missed a line-wrapped call site.
> ⚠ **`unavailable` is correctly ABSENT from `NspEvidenceAvailability`** — both NSP projections
> filter `.is('deleted_at', null)` (`rca.ts:258`, `capa.ts:366`) so it is unreachable, while
> `documents.ts` has **no** such filter, which is why the twin carries five. Tied in the doc comment
> to the **filter**, not to intent, so removing the filter makes the omission visibly wrong rather
> than quietly stale. Adding it would have been dead vocabulary reading as live behaviour — the same
> reasoning that keeps `HC0DM` out of the error map.
>
> ⛔ **State:** branch `main`, **NOT pushed**. All five DM flags ship **OFF**.
> ✅ graphify refresh **discharged** `02cec1a0` (was owed since the DM0–DM3 merge).
>
> **New this phase:** 🟡 **FUP-DM5-GRANTS** — `rca_evidence` / `capa_action_evidence` carry table-wide
> `arwdDxtm` to `authenticated`, so their RPCs are **not single doors**. ⚠ Calibrated: RLS *is* on
> with genuinely distinct read/write predicates, so this is hardening, not an open door — but DM5
> must not assume the RPC is the only writer when placing the `documents_wave_d` assert.


---

## S2 — NSP RCA/CAPA evidence onto the substrate: CLOSE

> ⛔⛔ **THE FIGURES IN THIS SECTION ARE THE FIRST CLOSE'S AND THEY ARE VOID.** This close was
> **rejected** — S2 was reopened at `52242f26` because the feature **did not work at all** while every
> figure below was green. **The section is retained verbatim as evidence of what a green close can
> assert**, and because its sub-sections on the arms, the ACL habit and the recurring classes are still
> accurate and durable. **Do not cite the gate-figures table.**
>
> ✅ **The REAL, current S2 figures** — re-measured by the lead on a fresh reset at HEAD `e2af9790`,
> tree clean, 2026-08-14: **8** migrations `20260927000100`–`000170` (not 6) · registry **399 == 399**
> (not 397) · pgTAP **192 files / 6284** (not 6272) · tsc **0** · lint **5/5** · vitest **1294** (not
> 1264) · all four arms **HOLD** (census 546/569 · hat 3 · floor 74 · wrapper BLIND 41) ·
> degenerate-body sweep **0** · diff-scoped sweep **COVERED / BLIND 0 / 1 case executed**.
>
> ⚠ **Why this banner is loud, and in prose rather than an HTML comment:** ADR 0120's own withdrawal
> root-cause #3 was *"the superseded text was marked with an HTML comment — invisible in rendered
> Markdown, so I quoted dead text as current. **A supersession marker only a raw-file reader can see is
> not a marker.**"* The reopen banner sits ~200 lines above this heading, under a different one; a reader
> who lands here by search or link would never see it. **That is the same failure, one file over.**

Migrations `20260927000100`–`000150` (6) · pgTAP `341` · ADR 0120 D1/D2/D10/D14/D15/D16.

### Gate figures (fresh `supabase db reset`) — ⛔ VOID, see the banner above

| check | figure (VOID) |
| --- | --- |
| registry | **397 registered == 397 files** |
| pgTAP | **192 files / 6272 tests PASS** |
| reconciliation | `341`: 30 to 41 · repo: 6261 to 6272 · **both +11** |
| tsc / lint / vitest | 0 · 5/5 · 1264/1264 |

### The four authz arms — named as arms, not as the script

| arm | the question it asks | result |
| --- | --- | --- |
| `ARM=census` | has anything **ever asked** about each live gate? | **HOLDS** — live 546 / verdicts 569 |
| `ARM=hat` | does any door read `memberships` **without the caller's hat**? | **HOLDS** — 3, all reasoned-allowlisted |
| `ARM=floor` | is every door **actually called**? | **HOLDS** — 74 never-called, all allowlisted |
| `FROMFINDINGS=1 ARM=wrapper` | `prosecdef = f` invoker wrappers | **HOLDS** — BLIND 41, all allowlisted |

**`ARM=census` stayed at 546 live, and that is correct, not an oversight.** No S2 function
qualifies as a census door: `app.assert_documents_wave_d_enabled` is `prosecdef = f` returning
`void`; `ensure_securable_resource_rca` / `_capa_action` return `trigger`; `add_rca_evidence` /
`add_capa_action_evidence` are composite-returning — the **pre-existing** 141 blind class, not
growth. `can_read_document` was already in the domain; the policy swap was net-zero. So **no new
door needed to join the census domain or the findings file.**

**Signature-keyed artifacts re-checked after the parameter change** — a signature change orphans a
signature-keyed entry exactly as a rename does. `authz-neverclled-door-allowlist.txt:37` updated in
the migration's own commit; findings file carries no entry for either door; line 41 deliberately
untouched (DM4's retired surface, FUP-AUTHZ-ALLOWLIST-ROT's positive control).

### Diff-scoped door sweep — 1 case COVERED, with its DOMAIN stated

Gate list derived from the migration diff (8 gates).

```
PREDICATE ARM:  COVERED  app.can_read_document(p_document_id uuid, p_uid uuid)
POLICY ARM:     (empty)
BLIND: 0   ERROR(harness): 0        over a domain of ONE
```

WARNING: the first run executed **zero cases** and printed `BLIND: 0` — indistinguishable from
clean. `CASES` matches bare `proname`, space-separated, exact; a pipe-delimited string is one token
matching nothing. **Not cited.** The re-run's nonzero count is what makes the verdict citable.

**4 of 5 requested gates are outside the harness's domain and were NOT swept** — recorded as
unswept, never as clean: `add_rca_evidence` / `add_capa_action_evidence` (composite-returning),
`hospital_of_capa_action` (uuid-returning), `capa_evidence_obj_insert_writable` (the policy arm
enumerates `public.*`; this policy is on `storage.objects`). Their only coverage is `341`.

Both runs overwrote `docs/reviews/authz-door-audit-findings.md`; restored with `git checkout --`
and the tree verified clean each time.

### The `…000120` REVOKE — FACT: falsified, then fixed

**Not a confirmed inference.** The reset did not confirm the hand-applied delta — **it falsified
the file.** That PUBLIC assertion had *never executed*: it was added while repairing an
already-registered migration, so only the hand-applied REVOKE ever took effect, and the corrected
file first ran at the reset, where it failed.

**"File and DB agree" is not "the file works."** Both agreed, and both were checked. Recording the
reproduction as fact then would have carried a broken migration into the gate with a green local
stack agreeing with it.

Now fact on a fresh reset: `anon_exec = false` on both doors; PUBLIC holds no EXECUTE
(`aclexplode … grantee = 0` false); 0 first-party `public` functions anon-executable.

### One habit, two opposite failures — the substring ACL test

`acl like '%=X/postgres%'` matched **every** function (PUBLIC is an aclitem with an *empty*
grantee, so it also matches `postgres=X/postgres`) — false positive in `…000120`. The variant
guarded with `and not like '%postgres=X/postgres%'` was **structurally incapable of firing** while
postgres held a grant — vacuous guard in `…000130`/`…000150`. *Asking a string a question only
structure can answer.* All sites — plus `…000110`'s presence check and `341` D4d — now use
`aclexplode`, with `D4e` added for the direction a presence check cannot see.

### Durable mechanism fixes (not phase details)

- **K9b asserts the OFF set is EMPTY** rather than naming a flag: it cannot go stale the next time
  a wave ships. A fix to the coupling mechanism itself, better than the coupling as designed.
- **`…000140` kept as its own migration** so BUG-DM5-CAPA-1's red was provable against the pre-fix
  catalog, and re-measured at HEAD `3b51c20d` (tree clean) rather than inherited from step 0.

### Recurring classes — counted, because the recurrence is the finding

- **Syntax-bounded enumeration: THREE instances**, three different authors' contexts, one shape —
  *the boundary was a syntax, not the property*: step 0's `.rpc('X')` sweep missing a line-wrapped
  call; the lead's `expiresAt` grep whose pattern never contained the term; this slice's derivation
  regex matching only `create or replace function` and missing a bare `create function`.
- **Text-as-truth: THREE instances** — the substring ACL tests (two opposite directions) and
  `prosrc like '%HC0DM%'` firing on the migration's own comment.
- **Measured vs. reasoned** — every claim produced by measurement held; every claim produced by
  reading and reasoning needed correction. That split, not authorship, is the phase's lesson.

### A code-design decision to defend against future "improvement"

`HC0D8` is raised for **both** absence and wrong-home/unreadable, deliberately: an error
distinguishing *"does not exist"* from *"not yours"* is an **existence oracle**.

Its cost, discovered live: **the ambiguity that blinds an attacker also blinds the test.** `341` F7
asserted `HC0D8` and received `HC0D8` — from "no such document", not "you may not read it" —
passing vacuously while F4/F6 went visibly red. **When a door answers one code for several causes,
a test asserting that code proves nothing about which cause fired; the discriminating fact must be
pinned separately, before the assertion runs.** `F5b` does that. The same shape applies to D12's
conjunction in S3.

### For `tester` — one seam a UI spec cannot reach

The **direct-PostgREST-DML path**: both evidence tables carry table-wide `arwdDxtm` to
`authenticated`, so a client can `POST /rest/v1/rca_evidence` without traversing the RPC. That is
why the shape rules are CHECKs and the flag is an assert. A UI-driven spec always goes through the
action and can never exercise the bypass — `341` F8 covers it in SQL. **A correctly-drawn boundary,
not a coverage gap.**

## Rotated from PROGRESS.md 2026-08-14 (the size rotation) — the live DM5 section, verbatim

> ⛔ **SUPERSEDED SNAPSHOT — do not read the block below as current state.** It is preserved
> **byte-for-byte** as it stood at the rotation, which is *before* S3's step 3, so it still says
> **"S3 IS NOT CLOSED"** and *"QA r2 re-review OWED"*. **S3 closed 2026-08-14 with an APPROVED r2** — the
> live status is the **§ "S3 … COMPLETE"** section at the head of this file. Left unedited deliberately:
> an archive that gets quietly corrected stops being evidence of what was believed when. ⚠ A `grep` for
> `S3 IS NOT CLOSED` **will** hit here — check which section you landed in.

> PROGRESS.md had grown back to **154 KB** against CLAUDE.md §7's "well under 60 KB". The live
> `## Current Phase Tasks` DM5 block (S3 + S2, lines 117-352) is preserved here **byte-for-byte**;
> the live file keeps the status, the gate figures and the resume point. ⚠ Two items in it were
> **NOT** duplicated anywhere before this rotation — the "three catalog facts were WRONG" table and
> the S2 close-then-reopen history — which is why the block is copied whole rather than summarized.

### 🔵 IN PROGRESS — **DM5: Wave D + retirement** (opened 2026-08-14) — the program's FINAL phase

> **Full detail → [dm5-wave-d-retirement.md](../progress/dm5-wave-d-retirement.md)** (rotated
> mid-phase 2026-08-14: the live file had hit **128 KB** against §7's "well under 60 KB", and every
> spawn reads it). Plan: [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md) ·
> ADR **[0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D16) · step 0:
> [dm5-surface-verification.md](../progress/dm5-surface-verification.md).
> Window `20260927000100`+ · pgTAP **`341`** · flag `documents_wave_d`.
>
> **Slices:** **S0 ✅** manifest tool (`0e85cbe7`, `9d37ad79` — 8/8 self-test controls, 3 of which
> found real defects; baseline self-labels **DEGENERATE**, not S4 input) · ~~S1~~ ⛔ **WITHDRAWN,
> never built** (D3/D4/D5 struck → **D11**; the mechanism was already built at DM2 and DM2 had
> rejected the proposed shape **by name**) · **S2 ✅ gate steps 1–2 COMPLETE** NSP RCA/CAPA evidence ·
> **S3 🔵 OPENED 2026-08-14** printed renditions (D6/D7/D11/D12/D13 + **D17**, every ruling made) ·
> S4 retirement (**8** buckets, manifest-first per D9) · S5 operational closure · S6 canon + exit sweep.
>
> ### 🔵 S3 — printed renditions onto the substrate (opened 2026-08-14, `backend` spawned, contract-first)
>
> Window **`20260927000300`–`000399`** · pgTAP **`342_dm5_s3_printed_renditions.sql`** (49), labels
> `DM5·S3<n>`. **Preceded by a lead resume audit** — baseline re-measured, S2's four owed arms
> discharged, 8 record defects fixed (`8e0cd6ab`, `d6494e2f`); detail in the phase record's
> `RESUME AUDIT` section. PO rulings **D17** (design for a reset remote) and **D18** (prints filtered
> out of Documentos) recorded in ADR 0120 before any SQL was written.
>
> ### ⛔⛔ THREE of the "catalog facts" the lead pinned here before spawning were WRONG — corrected in place
>
> Left uncorrected they would have misled every spawn, which is the exact trap this phase has been
> fixing all day. What was pinned → what `backend` measured (and the lead re-verified):
>
> | pinned by the lead | truth | why the pin was wrong |
> |---|---|---|
> | pgTAP **`341`** | **`342`** — `341_dm5_s2_nsp_evidence_substrate.sql` is **S2's own suite** | the number was assumed free, never `ls`'d |
> | `tenant_shape` carries 2 shapes so `form_response` forces a **third**, keystone all **three** | still **TWO** shapes — `responses.commission_id` is **NOT NULL**, so `form_response` joins the existing full-tenancy **arm 1** | the *decision* (which arm) was mistaken for a *new shape* |
> | `312`/`313`/`323` insert **11** `storage.objects` rows | **9** persist — a 10th site (`312:405`) sits inside a `throws_ok` asserting the insert is **refused** | counted insert *statements*, not *persisting rows* |
>
> ✅ **Correct as pinned:** `type_check` admits 8 types and `form_response` is the single D1/D6 addition;
> `pd_storage_path_derived` is a CHECK, not a column. Also false in the brief (and in ADR 0120 D17.1):
> **`seed.sql` inserts ZERO `printed_documents` rows** — so there was no seed rewrite in this slice, only
> the three pgTAP fixtures.
>
> ⭐ **The instruction carried into S3 from S2's failure:** *a new home type means enumerating EVERY
> dispatch on `resource_type` — `can_read_*` **and** `can_write_*`* — derived from the catalog as a
> **property**, never from an expected list of names. And **posting a contract is not implementing it**:
> S2's 11 placeholder bodies were left throwing and the slice was closed green.
> ⚠ **D12's conjunction is a STRICT NARROWING** — the kernel arm *implies* the print check, so only
> **one** refusal direction is reachable; pin the other **structurally** and do not fabricate a fixture
> for an unreachable state, nor change the authorization to make it testable (that proposal was rejected).
>
> ### ✅ S3 BUILD COMPLETE — steps 1 ✅ · 2 ✅ · 3 ⏳ **QA r2 re-review OWED** · 4 ⏳ PO
>
> **⛔ S3 IS NOT CLOSED.** QA returned **CHANGES REQUESTED (r1)**; `backend` discharged both blockers and
> four MINORs (`af9a894e`) and re-passed step 1 in full — but **QA has not re-reviewed the fixes**, so
> there is no `APPROVED` verdict and §6 step 3 is unsatisfied. **Next session: run the QA r2 re-review
> first** (brief in [dm5-handoff.md](../progress/dm5-handoff.md)), then take S3 to the PO.
>
> #### r1 gate re-run — fresh reset, lead-verified from the catalog (2026-08-14, HEAD `1513c094`)
>
> | check | figure |
> |---|---|
> | registry · pgTAP | **406 == 406** · **193 files / 6348 PASS** |
> | tsc · lint · vitest | 0 · **5/5** (0 warnings) · **1294** |
> | four ARMs | `census` **HOLDS** (live 546) · `hat` **HOLDS** · `floor` **HOLDS** · `FROMFINDINGS=1 wrapper` **HOLDS** |
> | degenerate bodies · findings file | **0** · **595** untouched |
>
> **Lead-verified directly, not accepted from the report:** `securable_resources_type_check` admits **9**
> types · `app.resolve_document_version_bytes` exists and **`authenticated` cannot EXECUTE it** (D12's
> scope requirement standing at the ACL) · the print arm is present in **both** kernel doors ·
> `printed_documents.storage_path` is **dropped** · degenerate bodies **0** · all six teammate commits are
> **ancestors of HEAD**.
>
> ⚠ **`backend` predicted 6346 and the suite said 6348 — its own arithmetic slip, reconciled against the
> in-file plan lines** (`312` 75→77, `342` 49→59, `6336 + 12 = 6348`) rather than restated. Worth keeping:
> *a prediction restated instead of reconciled is how a wrong number becomes a record.*
>
> #### r1's own lesson — the fix for MAJOR-1 was committed in MAJOR-1's shape
>
> `backend`'s MINOR-4 fix claimed a live misreport (a duplicate `p_id` answered `HC0D4`). **Measured,
> false:** the coordinate is a pure function of `p_id`, so a duplicate collides on
> `file_objects_bucket_path_uniq` **before** the `printed_documents` insert — *outside* the handler — and
> the keystone passed identically with the old broad handler. Relabelled **latent hardening**, and
> keystoned by **opening the lock that hides it** (dropping the coordinate unique in-transaction so the
> re-mint reaches `printed_documents_pkey`). ⭐ Two bugs in its own red-first harness were caught by the
> harness's **controls**, not by reading it.
>
> #### The step-1/2 detail that produced it
>
> #### ✅ GATE GREEN — the FIRST full `e2e:prod` run in DM5, at any point in the phase (lead, 2026-08-14)
>
> ```
> GATE SUMMARY: 1120 passed · 0 failed · 0 infra · 3 flaky · 0 did-not-run · 18 batches
> COVERAGE:     accounted for 1123 of 1129 collected      (1120 + 3 flaky; the other 6 are skips)
> ```
>
> **Read the accounting, not the verdict:** every one of the 18 batches reported `0 failed`,
> `0 did-not-run` **and** its own `accounted N/N` reconciling — so no batch dropped out of the
> denominator (the way a reset-failed batch does). The 6 "unaccounted" are the **6 skipped** tests
> (`phi-remediation` REM-8/REM-9, `user-registration` AC2 invite-mode, +3), all pre-existing and
> unrelated to S3: `1120 + 3 + 6 = 1129` collected, so the accounting is complete.
>
> ⭐ **`next build` ran and compiled** (`building standalone (next build)… ✓ Compiled successfully`) —
> **S3's first production build**, which is the only gate that catches a client value-import from a
> server query module (it aborts `next build` while tsc, lint and vitest all stay green).
>
> ⭐ **All 15 print tests ran and passed IN THE PROD BUILD** (batch 9), including the new
> `pdf-printing-meetings.spec.ts:399` **D18 test** — *"a meeting print is excluded from the Anexos panel,
> though its own row exists and would be listed without the filter, and its byte corridor still works"* —
> and `pdf-printing.spec.ts:38`'s full mint→download→verify→revoke→overlay→re-verify lifecycle. The
> latter was RED for `tester` on the shared stack; it passes here under `RESET=1`, which **confirms
> BUG-DM5-S3-ENV-FIXTURE-POOL-1 as category (c) environment** rather than a defect.
>
> **3 flaky, and 2 of them are the known pair** — `act-role-assumption:157` and `phase2-auth-shell:268`,
> i.e. FUP-E2E-REPEAT-FLAKY exactly. The third is **new**: `dm5-nsp-evidence.spec.ts:347` EVID-KBD-1, a
> keyboard-only test in **DM5's own S2 spec** (passed on retry #1) — S3 did not touch that file, and the
> shape matches the standing *"`.focus()` is not auto-waiting; it races RSC streaming"* class. Added to
> FUP-E2E-REPEAT-FLAKY as a third member. ⚠ Total flaky **3** against a historical baseline of ~18–27,
> which is better than baseline and therefore **not** evidence that flakiness is fixed — one green run
> does not establish a new baseline.
>
> #### The step-1/2 detail that produced it
>
> **Built** (`6ffd92ff` P0d · `859faa18` SQL cutover · `d964b61a` TS half · `e08cf4eb` smoke):
> migrations `…000300`–`000350` (**6**) — `form_response` into both coupled CHECKs · `printed_documents`
> becomes the **satellite** (`document_id`/`document_version_id` NOT NULL UNIQUE + a **composite FK** so
> they cannot disagree; `storage_path` **and** `pd_storage_path_derived` retired) · the **print arm in
> BOTH kernel doors** · `app.resolve_document_version_bytes` with `open_document_version` **and**
> `open_printed_document` both moved onto it (D12) · the mint rebuilt onto the substrate atomically ·
> four write guards. Fixtures rewritten in `312`/`313`/`323`; TS: D18 anti-join, moved coordinate,
> serving route.
>
> | step 1 check | figure |
> |---|---|
> | registry · pgTAP | **405 == 405** · **193 files / 6336 PASS** (6284 + 1 + 2 + 49, reconciles exactly) |
> | tsc · lint · vitest | 0 · **5/5** (eslint 0 warnings) · **1294** |
> | `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper` | **all HOLD** (census live 546 unchanged) |
> | diff-scoped door sweep | **BLIND 0 · ERROR 0**, 2 cases executed (nonzero), baseline asserted |
> | degenerate-body sweep | **0**, after every mutation run |
>
> ⭐ **Step 2 — the corridor EXECUTES, which is the one thing no static gate could say.** Lead ran the
> print specs against S3's code: **`pdf-printing` 9/9** and **`pdf-printing-meetings` 4/5** — real
> `%PDF-` bytes, mint → download → public verify → revoke → overlay → re-verify, plus the restricted
> (`participants_only`) meeting refusing a non-attendee. **S3 is not S2.** ⚠ Requires the **Gotenberg
> sidecar** (`docker start gotenberg-pdf`, `/health` 200 on :3010) **and `--workers=1`** against
> `next dev` — without those, 12 specs fail as uniform `/login` timeouts that read as product defects
> (`curl` answered the same route in 73 ms).
>
> **✅ Discharged since:** the full `e2e:prod` gate ran GREEN (above) · `tester` landed `02b2218d` — the
> retired-column re-point **and** the D18 twin, so the filter now **does** have an automated twin for the
> list half.
>
> **Still open, and NOT to be assumed:** **QA (step 3) not started** · `case`/`interview` prints
> **UNTESTED because unmintable** (`can_view_printed_document` has arms for `form_response`/`meeting`
> only — D6 is satisfied at the *type* level; two of four kinds have never produced a print) ·
> `add_referral_shared_item` never driven end-to-end (S3b pins both of its exclusions structurally, but no
> referral was created and no freeze attempted) · `file_objects.sha256` for a print is the minter's hash —
> server-side and verified as such, but **not** `finalize_document_upload`'s derivation, and it feeds
> `complete_document_disposal`'s duplicate-evidence probe · the smoke file is **not gate-resident**
> (`grep -n smoke package.json` → no hits) · `storage.objects` orphan behaviour on **Cloud** remains
> **no longer an S4 blocker — FUP-DM5-STORAGE-ORPHANS' remote half was a stale inference, amended: the
> orphaning line was reverted in the CLI (cli#3359) and is lead-verified ABSENT at the pinned v2.105.0,
> with an `auth` positive control** · `ARM=policy` was **not applicable** to this diff (it
> adds `prosecdef` gates, no RLS policy) — recorded as *not applicable*, never as clean.
>
> ⚠ **Two D18 half-truths corrected after implementation, both mine:** the **detail** half's filter landed
> on `queries/documents.ts`'s `getDocument`, which **no route imports** — the reachable same-named export
> in `queries/controlled-documents.ts` selects `from('controlled_documents')`, so prints are excluded
> **structurally, by the schema, not by D18** (ADR 0120 D18 amendment; FUP-DM5-DEAD-CORE-PROJECTION). And
> `form_response` prints have **no panel to leak into at all** — `DocumentHomeResourceType` does not
> include `form_response` — so the exclusion is untestable there for want of a surface, not for want of a
> test. **6 of 9 prints in the DB are that kind.**
>
> ### S2 ✅ — gate steps 1–2 COMPLETE. Baseline RE-MEASURED by the lead at HEAD `e2af9790` (2026-08-14)
>
> Migrations `20260927000100`–`000170` (**8**) · pgTAP **`341`** · the TS layer (11 stubs filled) · the
> S2 UI · 8 new E2E. **Every figure below was re-run on a fresh `supabase db reset`, not inherited from
> the closing report** — and every one reproduced the handoff's claim exactly:
>
> | check | figure |
> | --- | --- |
> | registry | **399 registered == 399 files** |
> | pgTAP | **192 files / 6284 PASS** |
> | tsc · lint · vitest | **0** · **5/5** · **1294/1294** (88 files) |
> | `ARM=census` — has anything ever *asked* about each live gate? | **HOLDS** — live 546 / verdicts 569 |
> | `ARM=hat` — does a door read `memberships` without the caller's hat? | **HOLDS** — 3, all reasoned-allowlisted |
> | `ARM=floor` — is every door actually *called*? | **HOLDS** — 74 never-called, all allowlisted |
> | `FROMFINDINGS=1 ARM=wrapper` — the `prosecdef = f` half | **HOLDS** — BLIND 41, all allowlisted |
> | degenerate-body sweep (§ the incident) | **0 hits** — no gate left open |
> | E2E (quick loop, not `e2e:prod`) | 8/8 new + **36/36 pre-existing at exact prior baseline** |
>
> ⭐ **The four arms were the ONE item S2 left owed.** The handoff recorded them as *"reasoned, not
> verified"* — no new gate or policy was added, so no new census entry *should* be owed. Now **run**:
> all four HOLD and census stayed 546, confirming the reasoning. *An unverified inference about a gate
> is not a gate result.*
> **Diff-scoped door sweep: `COVERED` · BLIND 0 · ERROR 0 · 1 case executed** — lead-verified at the
> pause (`eb863ce8`/`22148ca1`/`fa28ec19`); **inherited here, not re-run today.** The findings row and
> both kernel arms WERE re-verified against the catalog at HEAD.
>
> ⚠ **HISTORY — not current state. S2 was closed ONCE, WRONGLY, and reopened** (`b9e7dc7d` close →
> `52242f26` reopen). Retained because the lesson is the phase's most valuable artifact; all three
> defects are ✅ **FIXED** and re-verified (catalog + 0 stub bodies + green E2E):
> **`BUG-DM5-S2-STUB-1`** 11 TS bodies still `throw 'not implemented — DM5 S2'`, taking down the entire
> RCA/CAPA workspace for every persona · **`BUG-DM5-S2-WRITE-ARM-1`** `app.can_write_document` had no
> `rca`/`capa_action` arm, so `begin_document_upload` refused **everyone** with `P0002` (M2 extended only
> the READ counterpart) · **`BUG-DM5-S2-CITATION-TARGETS-1`** `listRcaCitationTargets` never queried
> `documents`.
>
> ⭐⭐ **THE LESSON, AND IT IS THE LEAD'S FAILURE.** S2 passed a fresh reset, **pgTAP 192f/6272**, tsc 0,
> **lint 5/5**, vitest 1264, and **all four authz arms** — and the feature **did not work at all**.
> **Not one of those gates can execute a page.** The lead recorded weeks earlier that the TS bodies
> were outstanding, wrote it down as *"expected under contract-first"*, and then accepted a close that
> never mentioned them; and steered backend exclusively toward `can_read_document`, never once asking
> what the **write** side dispatches on. [[green-bar-misses-the-wired-seam]] in its purest form yet.
> ⚠ **`ARM=floor` asks whether every door is CALLED and it HELD** — because it counts *doors*, not
> *door-arms*: the doors existed and were called for other home types.
> ⭐ **`tester` went a layer deeper than the first bug** — calling `begin_document_upload` by **raw RPC,
> bypassing the stub layer**, which is the only reason defect 2 was found. Had it stopped at defect 1,
> we would have wired the TS layer, re-run, and hit `P0002` with the "fix" already merged.
>
> ✅ **Resolved since the reopen:** the `…000120` `REVOKE` was **falsified by the reset, then fixed** —
> that PUBLIC assertion had never executed. Now fact on a fresh reset (`anon_exec = false` on both
> doors). *"File and DB agree" is not "the file works."*
>
> ⛔ **State:** branch `main`, **NOT pushed**, no `db push`. All DM flags ship **OFF** (`documents_wave_d`
> is ON in the **local seed only** — catalog-verified: migration default `false`, seed enables a–d).
> graphify ✅ `02cec1a0`.
> **Open:** 🔴 FUP-AUTHZ-HARNESS-TRANSACTIONAL (**a live authz gate was left OPEN on the shared stack**
> — read the phase record's incident section before running any mutation harness) · 🔴 FUP-DM5-STORAGE-ORPHANS
> (**blocks S4**; method half ruled, remote half open) · 🔴 FUP-PGTAP-VACUOUS · 🟠 FUP-DM4-RECUSAL
> (**DM5 does NOT close it**) · 🟠 FUP-DM5-FINALIZE-ATOMIC (**binding input to S5**) ·
> 🟡 FUP-DM5-GRANTS · 🟡 FUP-AUTHZ-ALLOWLIST-ROT · 🟡 FUP-DM5-DVF-FILEOBJ · 🟡 FUP-DM4-PRODROW.
> **✅ Both prose-only items FILED 2026-08-14 (lead), no longer untracked** → 🟠 **FUP-DM5-330-WRITE-BLIND**
> and 🟡 **FUP-PGTAP-WORKER-DEADLOCK** in [follow-ups-open.md](../progress/follow-ups-open.md).
> ⚠ On filing, the reassurance in the original note did not survive: it said `330`'s blindness is
> "covered by `341`, so not a blocker" — **`341` is S2's own suite**
> (`341_dm5_s2_nsp_evidence_substrate.sql`), which makes the claim *plausible but unverified*, and §6
> step 1 does not accept "another suite covers it" for a BLIND door. It is also **STALE-COVERED-shaped**:
> `can_write_document`'s body changed twice after that note (S2's arms, then `fc7a146d`).

---

## ↩ Rotated from PROGRESS.md 2026-08-17 (the §6-step-5 size rotation) — S5 / S4 / S3 detail, VERBATIM

> ⛔ **SUPERSESSION MARKER — added 2026-08-17 (pre-S6). The block below is NOT edited; it is
> evidence of what was believed at `fd69d4be`, and correcting it would destroy that.** Two of its
> statements have since been overtaken:
>
> | the block below says | current state | where the truth lives |
> |---|---|---|
> | *"**P4 `open_document_version` NOT MEASURED**"* (≈ the perf paragraph) | ⬛ **MEASURED 2026-08-17** — 8.2 ms cold / 3.8–4.0 ms warm, 121 buf warm, via the real finalize corridor | [S5 record](./dm5-s5-operational-closure.md) § 4 |
> | *"two gaps adopted as BINDING"* | **ONE** still binds — the **UNREHEARSED runbook**; P4 is discharged | same record, § "Two of §7's doubts" |
>
> ⭐ **The greps that will land here falsely:** `P4.*NOT MEASURED` · `open_document_version.*NOT
> MEASURED` · `Two gaps adopted as BINDING`. All three hit this archive first, and this note is the
> only thing standing between a reader and a stale answer.

PROGRESS.md was **152 KB** against CLAUDE.md §7's "well under 60 KB" target, and every teammate
spawn pays for it. The rotation had been recorded as OWED since the follow-up batch and deliberately
not folded in. These three slices are **CLOSED**, so their detail belongs here.

⚠⚠ **PRECISE PROVENANCE — read this before quoting the block below as "verbatim".** It was appended
byte-for-byte and `cmp`-verified against the source **before** the cut, and then **one mechanical
transform was applied afterwards**: every relative link `](docs/…)` was repointed to `](../…)`.
**Reason:** PROGRESS.md sits at the repo root, this file sits in `docs/progress/`, so a root-relative
link copied verbatim **404s here** — 15 of them did. ⭐ **The prose is verbatim; the link targets are
repointed.** Saying "byte-identical" without this note would be exactly the kind of
almost-true verification claim this phase keeps paying for.
_(Original wording of this paragraph, kept because the correction is the point:)_ the block below is a byte-for-byte copy of
PROGRESS.md lines 210–580 at `fd69d4be` (371 lines / 36,736 bytes; verified by `cmp` after the
append and before the cut). The blockquote `>` prefixes are the original's, kept so the copy is
literally the source text rather than a reflow of it.

⛔ **Much of this is ALSO already recorded above** in § S4 / § S3 and in
`dm5-s5-operational-closure.md`. That duplication is deliberate: a rotation that first checks
"is it already there?" is a rotation that loses whatever the check got wrong.

> ### ✅ S5 — operational closure — **BUILT + QA APPROVED (r2) 2026-08-17. Step 2 ✅ discharged by the batch gate; step 4 unrecorded (above).**
>
> **Gate: step 1 ✅ · step 2 ✅ (via the batch's shared `e2e:prod`) · step 3 ✅ APPROVED (r2) · step 4 unrecorded.**
> ⛔ **Step 2 was never a failure — it was deferred, and has now RUN.** _(This line read "⏸ DEFERRED BY
> PO DECISION … step 4 owed" until 2026-08-17, after the run had already happened.)_ ⭐ **Resume point:
> [dm5-handoff.md](../progress/dm5-handoff.md) §13** — the prioritised follow-up list, the E2E
> recipe, and the traps.
>
> ⚠ **The heading below read "Step 0 in progress" until 2026-08-17, long after step 0 landed and the
> whole slice was built and reviewed.** That is the defect this session caught four times in other
> files and then committed here: **a marker moves while the status line does not.** The three S5
> markers (this heading, the Phase Status row, the Slices line) are now edited together, on purpose.
> ⚠ **And it recurred within the day** — see the follow-up-batch block above, which the section was
> missing entirely while these same markers claimed the batch's gate was still owed.
>
> **Scope** ([plan](../plans/dm5-wave-d-retirement-plan.md) § S5): name the operational **owner and
> execution mechanism** (pg_cron / scheduled job / manual runbook) for the disposal job and the
> reconciliation command · one **backup/restore drill of DB + Storage TOGETHER** · baseline `EXPLAIN` +
> latency for document **list / open / sign** as the pilot's comparison point · and **S5.R**, the
> byte-path rehearsal (PO-directed 2026-08-17).
>
> ⚠ **S5 names owners and mechanisms; it does NOT invent values.** ADR 0114 **O1** (retention) and
> **O2** (scanner + `unscanned_accepted` expiry) stay with the PO. ⛔ ADR 0120 assigned this to "S4"
> until 2026-08-17 — S4 closed cleanly without it, which is how *a deliverable assigned to the wrong
> slice disappears.* Corrected in the ADR.
>
> **Binding inputs:** 🟠 **FUP-DM5-FINALIZE-ATOMIC** (finalize is FOUR round-trips; a failure after
> byte-verification orphans the document) · 🟠 **FUP-DM5-MANIFEST-FLAG** (`capture --out` vs
> `delete --manifest`; the wrong flag silently overwrote the committed S0 baseline) · 🟠
> **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** (a stack cycle destroys the storage volume — the drill above
> is what would have caught it) · 🟠 **FUP-DM5-STORAGE-ORPHANS** (Cloud half only).
>
> **Step 0 — surface verification, running.** → `docs/progress/dm5-s5-surface-verification.md`. This
> program has twice paid for skipping it: DM4's step 0 found **6 surfaces the plan never named**, and
> **S1 was WITHDRAWN ENTIRELY** because a capability was believed absent when it had shipped renamed.
> **No S5 build starts until step 0 lands.**
>
> #### backend — S5.D + drill + baselines, delivered 2026-08-17 → [record](../progress/dm5-s5-operational-closure.md)
>
> ✅ *(`backend` flagged here that the S5 header still read "Step 0 in progress". **Fixed 2026-08-17** —
> all three S5 markers now edited together. The original note is kept because it is evidence of the
> failure mode: a teammate saw the stale header, could not fix it (lead-owned), said so in place, and
> it still sat stale for hours. **Flagging a stale marker is not fixing it.** Original text: step 0
> landed `8bbf61aa`, S5.R
> landed `e5a1418e`. Left for the lead, who owns that line.)*
>
> - ✅ **Inherited artifacts reviewed as someone else's, and BOTH carried real defects.** The pgTAP
>   keystone **had never been executed**: `plan(11)` vs 12 was the smaller half — **the detector
>   detected ITSELF** (its `pg_temp` helpers carry the door's name in their own bodies; `pg_temp_N`
>   rows are ordinary `pg_proc` rows), so K2/K3a/K4 were RED **for a reason that is not the property**,
>   whose natural "fix" is to relax the assertion. Its header also asserted a **red-first observation
>   that had not happened** — *made true* (real caller in `public` → K4 RED naming it → reverted →
>   catalog verified → 12/12) rather than deleted, and an unverifiable "FIVE instances" count softened.
>   `plan(N)` → **`no_plan()`**, with the cost disclosed in-file: it does **not** catch silent
>   assertion loss, and the compensating control is a **lead-side** gate figure, not an in-file guard.
> - ✅ **S5.D (PO: document the gap, do NOT build the job).** `actions.ts:277-278`'s present-tense
>   claim that *"the disposal job + service-only completion door do the verified deletion"* corrected —
>   false in **both** halves. Gap pinned on both sides (`343_dm5_s5_disposal_gap.sql` +
>   `disposal-gap.test.ts`), **both observed RED against real mutations**; the TS pin's red names the
>   file *and* the function. Runbook: **`docs/deployment/phi-disposal-runbook.md`** — ⚠ **owner +
>   periodicity are ✅ **SET BY THE PO 2026-08-17** — owner = **the PO (repo owner)**, *not* a DPO role
>   (naming a role that may not be staffed pre-pilot = naming no owner); executor = **whoever holds
>   service-role reach** (ACL-forced); **monthly + out-of-band on a data-subject request**. ⚠ Real on
>   paper; real in practice only once the monthly run happens — the sequence is **UNREHEARSED**.
> - ⛔ **A 4th fix to `storage-manifest.mjs`, lead-ratified: the INDETERMINATE branch was UNREACHABLE
>   in the state that needs it.** `.list('')` on a bucket whose **row is gone** returns
>   `{data: [], error: null}` — so *"I could not ask"* and *"I asked and there is nothing"* were the
>   same value, and the classifier printed the **reassuring** arm (no `DO NOT PROCEED`) **on the
>   destructive path** for a bucket it never interrogated. ⚠ **The "state all eight retired buckets are
>   in" reason is WITHDRAWN — false in the present tense** (QA MINOR-6): measured, those eight hold **0
>   bytes and no volume directory**; it was their state *historically* and is a **Cloud** retirement's
>   state *by construction*. R3d's own reason above needs no frequency claim. Found only because a
>   control was built for a state nobody had observed.
> - ⛔ **QA r1 MAJOR-1 — the SIBLING of that fix, two lines below it in the same function, in the same
>   commit, was the same defect with the nouns swapped.** `verdictFor`'s `!proof.present` branch read a
>   missing volume **directory** as `CONSISTENT_EMPTY` — a **CLEAN** verdict — so `capture` printed
>   **CAPTURE CLEAN, exit 0** over a bucket the API said held live files, and it was
>   **non-monotonic**: partial byte loss dirty, **total** byte loss clean. That is a volume loss with
>   the DB intact — **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, the worse Rule-12 direction (metadata still
>   advertises the PHI file as servable; the reconciler reads the same API and is equally blind).
>   ✅ Fixed, red-first (**R7/R7-twin/C14/C15**, observed RED at `api_keys=5 volume_present=false exit=0
>   verdict=CONSISTENT_EMPTY`). ⭐ **The guard-set diff QA asked for found a SECOND gap in the same
>   branch:** a **failed** `docker exec` measurement also became `CONSISTENT_EMPTY` — now
>   `UNVERIFIED_PROOF_ERROR` (**C16**). **A fix applied to one arm is a question asked of every sibling
>   arm.** `rehearse` **18/18** (16 originals intact), `selftest` **17/17** (13 originals intact).
> - ⛔ **QA r1 MAJOR-2 — the Cloud risk was framed backwards: not a MISSING proof but a FAKE one.**
>   `locateVolume()` finds its container **by name via `docker ps`** and is never given the project
>   URL, so a machine with `supabase start` up while the client points at Cloud would compute a
>   byte-level proof **against the wrong project's bytes** — *no proof refuses visibly; a proof about
>   the wrong bytes passes.* ✅ **Guarded in the tool** (refuses a non-local `NEXT_PUBLIC_SUPABASE_URL`
>   while a local container runs; measured), placed in `locateVolume()` so **every** subcommand inherits
>   it, both polarities pinned by **C17** — which makes the "LOCAL stack only" domain **enforceable
>   rather than advisory**. Runbook §6 restated with **per-claim provenance**; the false
>   *"neither can hold for a Cloud project"* sentence and the blanket *"measured, not inferred"* header
>   are corrected — the Cloud consequence is labelled an **inference**, no remote contact was made.
> - ⛔ **Drill finding — a restore ONTO A BARE POSTGRES can report SUCCESS and silently lose 67% of
>   RLS.** ⚠ Precondition stated up front (QA INFO-4): this is a **misuse** of `supabase db dump`, not a
>   defect in it — the supported target is a **Supabase-initialized** database, and pre-creating
>   `auth`/`storage`/`extensions` + stub `auth.uid()`/`auth.role()` restores **full parity**. The
>   transferable finding is the **false-signal pair**, not the dump. Replaying
>   `supabase db dump` into a bare Postgres: `psql` **exit 0**, **490** true errors, **90 of 274
>   policies** restored, 161 of 165 tables — a database that *looks* restored, missing two thirds of
>   the security boundary. Confirmed by a 2nd measurement (pre-create 3 empty schemas + 2 stub fns ⇒
>   errors 490→10, tables and policies to **full parity**). ⚠ **Two false signals aligned**: `psql`
>   exits 0 without `ON_ERROR_STOP`, and `grep -c '^ERROR'` matches nothing (psql prefixes
>   `psql:file:line:`) — only the **catalog comparison** exposed it. Byte half executed via `docker cp`
>   (**245 files / 2,456,666 bytes**, per-bucket parity, **no stack cycle**); an API-based Storage
>   backup would today capture **0 of 245** files, because it enumerates from `storage.objects` (0
>   rows). ⚠ **A Storage backup is a PHI export** — 68 PHI-tier files in plaintext, undocumented
>   anywhere; my copy was deleted after verification.
> - ✅ **Baselines at a stated N** (`documents=3`, `file_objects=0`; synthetic arm +2000 rolled back),
>   measured as `authenticated` with real JWT claims because a plan taken as `postgres` bypasses RLS.
>   **P2 (per-resource panel) 1.3 ms → 364 ms**: Seq Scan with `app.can_read_document(id, uid)`
>   evaluated **per row** (24 201 buffers / 2001 rows) and **`public.documents` has only its PK index —
>   nothing on `home_resource_id`.** ⚠ P1's two numbers are **NOT a volume curve** (rows=2 at both;
>   the synthetic rows are not in the register's population — the drop is cache warming).
>   **P4 `open_document_version` NOT MEASURED** — `file_objects=0` and the write path is guarded
>   (*must be born reserved*; `reserved → verifying` rejected); stopped after two attempts rather than
>   guessing at a state machine.
> - ✅ **Gate:** pgTAP **194f/6363 PASS** (was 193/6351 — +1 file/+12 = exactly `343`) · vitest
>   **89f/1304** (was 88/1294 — +1/+10 = exactly the new pin) · lint **5/5 exit 0** · tsc **0**.
>   ⚠ **The lint baseline was stale — the gate was ALREADY RED at `e5a1418e`** (unused `cap7`,
>   verified via `git show`); ⭐ and that dead binding was a **missing control**, not a style nit — it
>   was R6-capture's **sighted twin**, unasserted, so the arm was satisfiable by a tool that verdicts
>   UNVERIFIED for *every* input. Now pinned. **Authz sweep: NOT APPLICABLE** (no RLS policy, no
>   `prosecdef` gate, no migration ⇒ no diff to derive a list from) — recorded as that, **not** "clean".
> - ✅ **QA r2 APPROVED** (0 P0 · 0 MAJOR · 6 MINOR · 6 INFO; `docs/reviews/dm5-s5-review-r2.md` @ `3363cc8e`) — remediation re-proved by neutralization, N1's R7 line **character-identical** to the pre-fix observation, **C15 passed with the fix reverted** (confirmed an over-reach bound). ⛔ **S5 NOT closable — `e2e:prod` PO-deferred, so gate step 2 is OWED.** Four MINORs taken now (record §6f):
>   - ⛔ **The tool printed a reassurance about the one control that is blind, where it is blind, on a destructive path** — the no-proof residual ended *"The count-comparison gate still holds."* R6 measures that very situation: `deleted=5 manifest=5 MATCH` **with a real file surviving**. *"Still holds"* is true of the comparison **executing**, false of what a reader takes from it — **this slice's own class, one layer up, inside the remediation for it.** Now states the bound (cannot see an under-count or a two-way divergence; refuses only an over-count) and the **wording is pinned** by new arm **R6-residual**, which also forbids the old sentence returning.
>   - **The enumeration was complete on NAMES and incomplete on PATHS — nine verdicts over ELEVEN paths.** `MISSING_BYTES` via **PARTIAL** loss had no control, and that was **the half of the non-monotonicity claim the MAJOR-1 fix was justified by** — asserted by the code comment and runbook §6(c), observed by nobody. ✅ **R9 + R9-monotonic** now measure it and assert the convergence itself.
>   - **Surplus version files read CLEAN** (5 keys / 6 files ⇒ `CONSISTENT`, exit 0 — the verdict is key-set based). Left a **residual**, not dirty: no supported operation on this Storage version produces it (an upsert replaces the version file). ⛔ **Trigger condition named in the code — if any Storage version starts RETAINING versions, surplus files become bytes NO KEY CAN ADDRESS (undeletable, invisible to a key-set comparison ⇒ undisposable PHI under Rule 12) and this must become a dirty verdict.** Re-read on the next `supabase` upgrade.
>   - **Two drill-record corrections, both re-measured not inherited:** the `^ERROR` anchor is **invocation-dependent** and I had stated it as a property of `psql` (`-f` → 0 matches; **stdin → 2**) — *the lesson strengthens: a detector validated under one invocation is not validated* · ⛔ **ARM B does NOT reach "full parity" — triggers 227 vs 235.** I measured tables+policies, saw parity, and generalised — the same defect one layer out. The 8 missing are all on **platform** tables my stubs never created, and include **`protect_buckets_delete`, `protect_objects_delete`** (the guards this phase relies on) and **`on_auth_user_created`**. So ARM B was a **diagnostic, never a valid restore** — and this is the strongest argument for the runbook's own comparison query, which includes `triggers` and would **correctly refuse** it.
> - 📋 **Filed, not fixed:** 🔴 **FUP-DM5-NO-ANSWER-VS-NOTHING** (a **CLASS**; 🟠→🔴 on instance 3) ·
>   🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** · 🟠 **FUP-DM5-CLOUD-ORPHAN-SURFACE** (a **promotion**, kept
>   promoted) · 🟠 **FUP-DM5-DISPOSAL-JOB**. ⛔ **20 NOT-COVERED items** (⭕ recounted at the phase QA
>   2026-08-17 — this line said **13**) in the record — read before S6.
> - ⚖️ **Three lead rulings recorded 2026-08-17** (record §6b): ① the door's metadata-only absence check
>   **IS** the NO-ANSWER class and **escalates to 🔴** — on Cloud `disposed` is not merely unchecked but
>   **unverifiable**, so it can never mean more than "metadata gone" there; filing it *undecided* was
>   ruled the correct call · ② the S3 promotion **stands** — cross-link, do not merge · ③ the PHI-export
>   finding is **filed 🔴 and changes the runbook** (new §6b). ✅ **PO then SET every outstanding value
>   2026-08-17** (record §6c): encryption **at creation** (never plaintext on disk; key stored
>   separately) · location **outside the repo AND outside any sync root** (a copy into a synced dir
>   silently replicates 68 PHI-tier files to a third-party cloud — nothing in the platform would
>   notice) · reader set = the owner alone · retention **until the next backup is verified good, max
>   30 days** · destruction **key first, then archive**. ⭐ The **retention rationale** is written in —
>   the 20-yr obligation belongs to the **system of record, not to backups**, so **short backup
>   retention is a SAFETY property**, stated so nobody "fixes" 30 days up to 20 years. ⛔ **"Verified
>   good" = CATALOG-COMPARED, never `psql` exit 0** (cites this slice's drill: exit 0 · 490 errors ·
>   90/274 policies). ⚠ Only the **literal path** was not invented — per-machine, recorded at first run.
> - 🔒 **Two gaps adopted as BINDING — S6 may not close over them:** **P4 `open_document_version`
>   NOT MEASURED** (stopping rather than guessing at a state machine was ruled correct — *a fabricated
>   baseline is worse than a missing one*) · **the runbook sequence is UNREHEARSED** (*naming an owner
>   is not a rehearsal, and writing a runbook is not running it*).
>
> ### ✅ S4 CLOSED 2026-08-17 — legacy bucket retirement — steps 1 ✅ · 2 ✅ · 3 ✅ **APPROVED (r3)** · 4 ✅ PO
>
> **All five gate steps closed.** QA r1 ⛔ → r2 ⛔ → **r3 ✅ APPROVED** (0 P0 · 0 MAJOR); PO approved the
> slice 2026-08-17. ⚠ **A SLICE verdict — DM5's phase QA is still owed at S6, and it authorizes no part
> of S5.** Detail rotated to **[the DM5 record](../progress/dm5-wave-d-retirement.md) § S4** and
> **[the handoff](../progress/dm5-handoff.md) §§11–12**; reviews:
> [r3](../reviews/dm5-s4-review-r3.md) · [r2](../reviews/dm5-s4-review-r2.md) ·
> [r1](../reviews/dm5-s4-review.md). ⛔ **Not relieved by the approval: Cloud is UNVERIFIED in all
> three rounds, and the deploy-time byte path is UNREHEARSED (owned as S5.R).**

> **QA r1 verdict 2026-08-17: ⛔ CHANGES REQUESTED** — 0 P0 · **2 MAJOR (both blocking)** · 7 MINOR ·
> 4 INFO. [review](../reviews/dm5-s4-review.md). ⭐ **The BUILD is sound — no code change requested**:
> the migration, its byte-first guard and **every** successor assertion were re-proved by neutralization
> (8 rolled-back mutations, `app.can_write_document` md5 identical before/after, degenerate bodies 0
> after each). **Both blocking items are record/coverage defects, and both are mine.**
> - **B1** — the 221 orphan files **no longer exist** (volume recreated `01:06:02Z` by the lead's own
>   stack recovery); I reported them as present and had the PO rule on them **3h11m after they were
>   gone**. A disposal without evidence inside the slice that ratified D9. → corrected everywhere +
>   **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**.
> - **B2 — ✅ CODE FIX LANDED** (`140ffd8c`), **but the gate figure is NOT re-established (see below).**
>   R15 DELETEd `nsp-evidence` and asserted only `not 200 / not 204`; the retired bucket,
>   `documents-phi` **and** `form-assets` all answer `400 {"statusCode":"404"}` — **indistinguishable**.
>   Rewritten to plant a REAL object via the product corridor and make the discriminating fact the
>   object's **survival** (service-role re-fetch + byte compare), status codes demoted to "weak signal
>   only". **Proven able to fail** (service-role bearer ⇒ RED). ⛔ **RE-CORRECTED 2026-08-17 by QA r2
>   (MAJOR-3): the "codebase-wide assumption" this claimed to correct was itself INVERTED.** It said
>   `storage.protect_objects_delete` *"fires before RLS and is the operative guard"*. On the **HTTP
>   path — the one R15 attacks — the trigger never fires at all**: `protect_delete()` is role-agnostic
>   and tests only `storage.allow_delete_query`, and the Storage API sets that GUC itself (its own HINT
>   **exception message** ends *"Use the Storage API instead."* — corroboration, not the proof, and the
>   HINT is a different string; QA r3 MINOR-10). **The operative locks are the two ABSENT policies, SELECT and
>   DELETE, and both are ours** — opened together, the same authenticated HTTP DELETE returned
>   `200 Successfully deleted` and destroyed the object. The trigger guards **direct SQL DML only**,
>   which is the context `…000400` needs it for. ⭐ The earlier probe opened **one** of two locks *and*
>   ran at the raw-SQL layer — the single path where the trigger IS unconditional, so the only path that
>   could not see the RLS lock. `143`'s label restored to its original substance (assertion unchanged,
>   38 == 38). ⚠ Domain: LOCAL stack, both paths; **not verified against Cloud**. And `storage.objects`
>   grants `arwdDxtm` to `authenticated` **and `anon`** — no grant-level fallback, so every storage
>   protection here is exactly **one permissive policy wide**.
>
> ### ✅ RESOLVED 2026-08-17 04:49 — the E2E figure is ESTABLISHED at **1121**; this block is now HISTORY
>
> ✅ **The blocker below is discharged.** Re-run on a **freshly-rebooted** machine (uptime 0.0 h):
> **`1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches`**, and pgTAP
> **193 / 6351 PASS with 0 deadlocks** — the 17-suite `Bad plan … ran 0` storm gone too. ⭐ **The
> diagnosis below (the machine, not the code) is now CONFIRMED BY MEASUREMENT rather than inferred**;
> the same suite that was unrunnable four times completed 18/18 batches untouched. Restatement +
> the three individually-verified claims: the DM5 record § "Gate step 2".
>
> ⛔ **The ~~1118~~ figure remains SUPERSEDED** — it predated the R15 fix and counted a vacuous
> security pin. It is replaced by 1121, not revived. The table below is kept because *"nothing failed"
> and *"nothing ran"* being different facts is the lesson, not the attempt count:
>
> **Rotated at step 5** — the four-attempt table, the five environment traps, and the `193 files / 5900`
> HANDOFF-1 deadlock analysis were **copied verbatim** into
> **[the DM5 record](../progress/dm5-wave-d-retirement.md) § "The four dead gate attempts"** before
> being cut here. ⚠ They were also in the handoff, but the handoff **dies with DM5** and these outlive
> it — so the record, not the handoff, is the destination. The two lessons in one line:
> **`TaskStop` does not reap the gate's process tree — verify with `Get-Process`, never from a
> notification**, and **"nothing failed" is not "nothing ran."**
> - QA also **solved** the `SET LOCAL` puzzle I had recorded as unexplained, and **corrected two of my
>   claims about it**: it is *not* e2e-path-specific (a plain reset emits **six** `25P01`; I had read my
>   own run through `tail -25`), and my "the guard refuses" probe was taken at the **wrong grain**
>   (post-reset live DB ≠ migration-apply time). The fix stands; the causal story did not.
> - ⚠ **INFO-3, worth carrying forward:** `p0-authz-invariant.sh:295` bounds the census at
>   `nspname='public'`, so the four dropped `storage.objects` policies were **never in any arm's
>   domain**. "Four arms HOLD" is true and is **zero coverage of this diff**.
> - ⚠ QA did **not** re-run `e2e:prod` — the 1118 / print-corridor figures were inherited, not
>   re-measured, and B2 lives in exactly that layer.
>
> **PO authorized S4 explicitly on the day** (separately from S3's approval, per the handoff §11 gate);
> **FUP-DM5-D11 deferred — "decide later"**, and nothing in S4 depended on it. Full detail:
> [the record](../progress/dm5-wave-d-retirement.md) § S4.
>
> **Built:** migration **`20260927000400`** — drops the last 4 retirement-bucket policies (all
> `nsp-evidence`) + the **8** bucket rows, behind a guard that **refuses** to retire a bucket still
> holding `storage.objects` rows (D9's byte-first ordering encoded executably) · pgTAP **`325` 5 → 8**
> (t6/t7 retirement pins **proved RED-FIRST against the real pre-migration catalog**, naming every
> survivor; **t8** = the survivor positive control, because a sweep that retired *everything* would
> satisfy t7) · successor assertions in `200`/`142`/`143`/`341` · dead bucket constants removed from
> `src/lib/attachments/constants.ts`. Survivors: `documents-standard`/`documents-phi` (core, D8) +
> `form-assets`/`meeting-audio` (out of scope, D13).
>
> ⛔ **THE BYTE HALF WAS A NO-OP, AND IS RECORDED AS THAT — NOT AS "RETIREMENT PROVEN".** Measured
> first: `storage.objects` **0 rows in all 12 buckets** vs **866 files / 9.9 MB / 235 PHI** on the
> volume (**221 / 6.93 MB / 15 PHI** in the 8 retirement buckets — reproducing S0's figure exactly).
> Every retirement-bucket byte is **already an orphan with no metadata row**, so the Storage API — the
> D9 *gate* — cannot address one of them; `capture` returned its `DEGENERATE BASELINE` verdict by
> design and **`delete --execute` never ran**. What S4 closed is the metadata/schema half, and it
> **stays** closed across `db reset` — which six historical migrations would otherwise undo.
> ⚠ **So the deploy-time byte sequence remains UNREHEARSED end-to-end** (ADR 0120 D9 now carries an
> inline EXECUTION NOTE saying so); its correctness still rests on S0's 8/8 self-test.
> ✅ **OWNED 2026-08-17 — PO directed the rehearsal into S5 as `S5.R`**
> ([plan](../plans/dm5-wave-d-retirement-plan.md) § S5.R): the **with-metadata** path (the condition
> production is in, and the one S4's no-op skipped) on a purpose-made disposable bucket, all four
> acceptance items proven able to FAIL. ⚠ **Still UNREHEARSED until S5.R runs** — naming an owner is not
> a rehearsal.
>
> | gate step 1 | figure |
> |---|---|
> | registry · pgTAP | **407 == 407** · **193 files / 6351 PASS** (S3's 6348 + 3 new `325` pins) |
> | tsc · lint · vitest | 0 · **5/5** · **1294** (unchanged — the removed TS had no test, which is *why* it was removable) |
> | four ARMs, exit codes captured **unpiped** | **all HOLD** — census live **546** / verdicts **570** (identical to S3's close: S4 added no gate, so no census entry is owed) · hat 3 allowlisted, self-test 6/6 · floor allowlisted · `FROMFINDINGS=1` wrapper BLIND **41** ⊆ allowlist |
> | diff-scoped `ARM=policy` | **NOT APPLICABLE — recorded as that, never as clean.** The diff *drops* 4 policies, adds/modifies none, touches no `prosecdef` body ⇒ empty domain. *A dropped policy has no gate to open.* |
> | **step 2 — `e2e:prod`** | ✅ **GATE GREEN, RESTATED 2026-08-17: `1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches`** (2 infra re-runs, batches 6+11, both clean on re-run). Per-batch **1129/1129 accounted, 0 did-not-run in every batch**; 1121+2+6 = 1129 collected — the summary's `1123 of 1129` excludes skips. ⭐ Reconciles to the suspended 1118 **exactly**: collected and skips unchanged, so +3 = the 3 tests flaky then and clean now (5→2 flaky); R15 was one test replaced by one test. `pdf-printing` **9/9** + `pdf-printing-meetings` **6/6** verified individually; **0 `not ok`** across the 18 logs the runner itself named. The ~~1118~~ figure is SUPERSEDED, not merely unquotable |
>
> ⭐ **The check S4 owed the most, because it deleted the bucket S3's corridor was proven against:**
> `pdf-printing` **9/9** + `pdf-printing-meetings` **6/6**, identical to S3, **zero** non-ok in any
> print/document/evidence spec. **The corridor still mints real `%PDF-` bytes with `printed-documents`
> deleted** — independent confirmation that S3's re-pointing onto the core substrate is real.
>
> 🔒 **The defect S4 nearly shipped to the REMOTE.** The first version used `set local
> storage.allow_delete_query = 'true'` (copying `20260921000300`), which is a **silent no-op** —
> `WARNING (25P01): SET LOCAL can only be used in transaction blocks` — against a step whose refusal
> (`42501` from `storage.protect_delete`) is real. Fixed by moving opt-in + DELETE into **one `do`
> block**. → **FUP-DM5-SETLOCAL-MIGRATION** (`20260921000300` still carries the old idiom).
>
> ⛔ **This paragraph carried BOTH of QA r1's MINOR-1 and MINOR-2 errors until 2026-08-17, and three QA
> rounds did not catch this copy** — it surfaced only while rotating the block at step 5. It claimed the
> warning appeared when *"the E2E gate's own reset"* ran after *"a standalone reset"* passed (**false —
> a plain `db reset` emits SIX, one from `20260921000300`; the path was never load-bearing**), and that
> the opt-in was *"probed"* as load-bearing (**that probe was taken at the wrong grain** — a post-reset
> live DB, not migration-apply time). r2 recorded MINOR-1 closed in two files with a residual in the
> handoff; **this was a sixth location nobody enumerated.** ⭐ *The fix stands; only its explanation was
> wrong — so state it as a property of `set local` in a migration, never of a runner.*
> → [[a-predicate-quoted-at-the-wrong-grain]].
>
> ⭐⭐ **Two lessons worth more than the slice.** (1) **My reference sweep was bounded by ONE property
> and the breakage lived in another** — I swept `storage.buckets` reads and `storage.objects` inserts,
> found exactly one breakage, and pgTAP then returned **4 reds**, every one an assertion that the
> *policies I was dropping* still exist. (2) **Those broken assertions failed in OPPOSITE directions
> and only one direction announces itself:** three went RED, but two Rule 6 *"NO update/delete policy"*
> pins went **VACUOUS** — zero policies satisfies them forever, silently, sitting in the passing column
> of a green suite. **Had I fixed only what the suite reported, S4 would have left two dead pins
> reading as coverage.** Both replaced; `341`'s BUG-DM5-CAPA-1 pin re-keyed off the retired policy NAME
> onto the live `can_write_document` arm — and tightened to the **call** form after neutralization
> showed the bare-name form was satisfied by the body's own **comment**.
>
> ### ✅ S3 CLOSED 2026-08-14 — steps 1 ✅ · 2 ✅ · 3 ✅ **APPROVED (r2)** · 4 ✅ PO
>
> QA r1 = **CHANGES REQUESTED** (0 P0 · 2 MAJOR blocking · 6 MINOR · 2 INFO); `backend` discharged both
> blockers + four MINORs (`af9a894e`); **r2 = ✅ APPROVED** (`801a2589`,
> [review](../reviews/dm5-s3-review.md)) — **every blocking item re-proved by neutralization, not read.**
> ⭐ r2 did what r1 could not: with guard 4 deleted from the live body, the new **`S3k2` goes RED
> (`caught: no exception / wanted: P0002`) while `S3f4` stays GREEN** — the pair now *discriminates*, which
> is exactly what MAJOR-1 said it could not. ⭐ **r2 refused to inherit the lead's own correction of r1's
> MAJOR-2 premise and re-derived it**, then applied the declined `REVOKE` in-transaction and showed the
> `home_resource_id`-only walk yields the coordinate **before and after** — the revoke is *effective and
> closes nothing*, so declining it was right. r2 also proved red-first the two assertions `backend` had
> **not** (`t51c`/`t51d`). Safety: **8 mutation-bearing runs, every one a rolled-back transaction**,
> degenerate bodies **0** after each, and `begin_document_upload`'s md5 **byte-identical to r1's**.
> **Step 4:** PO instruction *"run the QA and conclude S3"* — approval delegated in advance, **contingent
> on an APPROVED r2**; had r2 reddened, this would have looped to step 1 instead. ⛔ **A slice verdict, not
> the phase gate** — DM5 phase QA is still owed at S6, and **r2 authorizes no part of S4.**
>
> #### Gate at HEAD `801a2589` — fresh reset, lead-verified from the catalog (2026-08-14)
>
> | check | figure |
> |---|---|
> | registry · pgTAP | **406 == 406** · **193 files / 6348 PASS** |
> | tsc · lint · vitest | 0 · **5/5** (0 warnings) · **1294** |
> | four ARMs — **re-measured by the lead at `801a2589`**, because `…000360` rewrites a `prosecdef = t` body and **`ARM=census` is the one arm that catches a gate you just added** (r2 had accepted step 1 as *reported*) | **all four HOLD**, exit 0, never piped: `ARM=census` *has anything ever asked?* → live **546** / verdicts **570** (570 ≥ 546 is the invariant; the surplus is verdicts for gates no longer live = FUP-AUTHZ-ALLOWLIST-ROT, **not** a defect) · `ARM=hat` *does a door read `memberships` without the caller's hat?* → 3 reasoned-allowlisted, self-test **6/6** · `ARM=floor` *is every door called?* → **74** never-called, all allowlisted · `FROMFINDINGS=1 ARM=wrapper` → BLIND **41** ⊆ allowlist |
> | diff sweep · degenerate bodies · findings file | BLIND 0 · ERROR 0 · **0** · **595** untouched |
> | `e2e:prod` — the FIRST full run in DM5 | **1120 passed · 0 failed · 0 did-not-run · 3 flaky · 18 batches**; `next build` compiled |
>
> ⭐ **The corridor EXECUTES — the one thing no static gate could say.** `pdf-printing` **9/9** and
> `pdf-printing-meetings` **6/6**: real `%PDF-` bytes, mint → download → public verify → revoke →
> overlay → re-verify. **S2 passed every static gate while its feature did not work at all; S3 has been
> run.** ⚠ Requires the **Gotenberg sidecar** (`docker start gotenberg-pdf`, `/health` 200 on :3010)
> **and `--workers=1`** against `next dev`.
>
> #### ↩ S3's detail ROTATED at closure (2026-08-14) — §6 step 5
>
> Now that S3 is closed, its narrative lives in **[the record](../progress/dm5-wave-d-retirement.md)**
> (§ "S3 … COMPLETE", incl. steps 3–4 and the safety record) and **[the handoff](../progress/dm5-handoff.md)
> §§9–11**. Cut from here, each preserved there first: the lead's direct catalog verifications · the
> **"still open, NOT to be assumed"** list (`case`/`interview` prints **unmintable**, so D6 holds at the
> *type* level only · `add_referral_shared_item` never driven end-to-end · the smoke file **not
> gate-resident** · `ARM=policy` **not applicable** to this diff, *recorded as such, never as clean*) ·
> the **D18 post-implementation correction** (the filter landed on an unimported `getDocument`; the
> reachable one excludes prints **structurally**). ⚠ **An `APPROVED` slice is not an absence of gaps** —
> r2 restated that list as its own "not re-verified" section, so **rotation moved it, it did not settle it.**
>
> **Open follow-ups this phase must NOT assume closed:** 🔴 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** (**a live
> authz gate was left OPEN on the shared stack — read the record's incident section before running any
> mutation harness**) · 🟠 **FUP-DM5-STORAGE-ORPHANS** (⚠ **NOT closed by S4** — S4 demonstrated the local
> half rather than clearing it: the manifest-first delete was a **no-op** because all 221 retirement-bucket
> files are already metadata-less orphans, unreachable through the D9 gate **by definition**; ⛔⛔ **CORRECTED 2026-08-17 by QA
> B1 — the 221 files are GONE and did NOT go through the gate: the lead's own `supabase stop`/`start`
> stack recovery recreated the volume at `01:06:02Z`. A disposal of 15 PHI-tier objects with no
> manifest, no count comparison, no audit — inside the slice that ratified D9. The PO ruling to "leave
> them" was MOOT when given, 3h11m after the fact.** ✅ **RE-PUT AND RULED 2026-08-17, on a measurement
> taken at decision time — the CURRENT ruling, superseding "leave them": 0 files in all 8 retired
> buckets, and the PO ratified the local volume as NON-DURABLE DISPOSABLE TEST RESIDUE** (no cleanup
> step, no gate, no local manifest discipline). The retirement-scope question closes **empty by
> measurement**; ⭐ the survivor-bucket files are **not** retirement residue but E2E/print artifacts the
> reset orphans as it runs, so local orphan accumulation is a standing byproduct of `db reset`. **Item
> stays OPEN on its Cloud half ONLY** → new **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** (undischarged — S5.R
> governs the *deliberate* path, not the accidental one); and `delete --execute` has still never run
> against a populated bucket — ✅ **now owned as `S5.R`**, though naming an owner is not a rehearsal)
> · 🟠 **FUP-DM5-SETLOCAL-MIGRATION** (**new, S4** — `set local` in a migration is
> not guaranteed transactional; `20260921000300` still relies on it) · 🔴 FUP-PGTAP-VACUOUS ·
> 🟠 FUP-DM5-SIBLING-GUARD-DIFF · 🟡 FUP-DM5-DVF-FILEOBJ · 🟡 FUP-PGTAP-WORKER-DEADLOCK · 🟡 FUP-DM4-PRODROW.
>
> #### ⚠ THE LIST ABOVE WAS STALE — six of its entries were CLOSED and it still said "must NOT assume closed" (corrected 2026-08-17)
>
> A list whose job is to stop you assuming closure, itself asserting closure-not-yet-reached for six
> items that had closed, is the same failure as the State block below: **the reader's guard is exactly
> where the rot is invisible.** Cut from the list and recorded here instead —
> ⬛ **FUP-DM4-RECUSAL** (`32054942` · ADR 0122 · ⚠ **local catalog only, NOT on the remote**) ·
> ⬛ **FUP-DM5-FINALIZE-ATOMIC** (`20260928000500`) · ⬛ **FUP-DM5-330-WRITE-BLIND** (`330` plan 57→62;
> ⭐ closed *on its own terms* — the blindness was **re-derived from the live catalog** and was still
> real, and it was explicitly **not** closed on `342`'s coverage, which is what the old warning
> demanded) · ⬛ **FUP-DM5-GRANTS** (`20260928000200`) · ⬛ **FUP-AUTHZ-ALLOWLIST-ROT** (found **six**
> stale entries where the item named one) · ⬛ **FUP-DM5-MANIFEST-FLAG** (**no code change — it was
> already fixed in S5 and never marked**, which is this same defect one turn earlier).
> Evidence for each: the follow-up batch block at the head of this section.
>

---

## ↩ Rotated from PROGRESS.md 2026-08-17 — the Phase Status **DM row**, VERBATIM

That single table row was **11,543 bytes** — a third of the whole Phase Status section, in one
cell. PROGRESS.md's own rule at the top of that table says *"Gate headlines stay in this table; the
verbose Build/Tests/QA/Commit prose rotates."* This is that rotation.

⚠ **Preserved BEFORE the cut** (`cmp`-verified against the live row). The row is reproduced as a
single line, exactly as it stood at `fd69d4be` after the same-day corrections to its two stale
claims (the "two local-only migrations" count, and FUP-DM4-RECUSAL listed as open).

```
| DM | **Document Model Redesign** [0114](../decisions/0114-document-model-redesign.md) (+Amdt 1/2) · ADRs [0116](../decisions/0116-dm1-substrate-cutover-decisions.md)/[0117](../decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md)/[0118](../decisions/0118-dm2-s2-command-layer-decisions.md)/[0119](../decisions/0119-dm4-referral-document-substrate-decisions.md)/**[0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)** · [plan](../plans/document-model-redesign.md) | ✅ **DM0–DM4 complete** · 🔵 **DM5 OPEN** (S0 ✅ · ~~S1~~ WITHDRAWN · S2 ✅ · **S3 ✅ COMPLETE, r2 APPROVED** · **S4 ✅ COMPLETE 2026-08-17 — all 5 gate steps, QA APPROVED r3** (r1 ⛔ → r2 ⛔ → r3 ✅; every blocking item across three rounds was a RECORD defect — no code change was ever requested); ⚠ **the byte half was a NO-OP** (rehearsal now owned as **S5.R**, still UNREHEARSED) **and the 221 orphan bytes were DESTROYED OUTSIDE THE GATE by a stack recovery** (PO ratified the local volume disposable 2026-08-17; FUP-DM5-STACK-CYCLE-DESTROYS-BYTES stays open) · **S5 ✅ BUILT + QA APPROVED r2 2026-08-17 — ⏸ NOT CLOSED: gate step 2 (`e2e:prod`) is PO-DEFERRED until the follow-ups are resolved, step 4 owed** (delivered: S5.R rehearsal · S5.D disposal runbook + the gap pinned on BOTH sides · backup/restore drill · EXPLAIN baselines; record [dm5-s5-operational-closure.md](../progress/dm5-s5-operational-closure.md)) · **S6 remains, not started** ) — ⚠ **DM5's phase QA is still owed at S6; S4's AND S5's are SLICE verdicts.** · ✅ **FOLLOW-UP BATCH GATE RUN 2026-08-17** (`4f16ea5f`): registry 412==412 · pgTAP **194f/6392** · lint 5/5 · tsc 0 · vitest 89f/1304 · **4 authz ARMs HOLD** (census 546/570 · hat 3 allowlisted · floor 74 allowlisted · wrapper BLIND 41 ⊆ allowlist) · diff-scoped `ARM=policy` **NOT APPLICABLE, argued + measured** (274 policies unchanged, no policy statement in the diff) · `e2e:prod` **GATE GREEN 1118p/0f/5 flaky/0 did-not-run/18 batches**. ⭐ its `1123 of 1129` coverage line was **checked, not accepted** — every batch reconciles `N/N`, the 6 are skips, **no unrun tests**. ⚠ 4 INFRA re-runs incl. a NEW shape: **batch 8 crashed exit 127 (command not found), 40 tests unrun**, re-run to 40/40. ✅ **PO-APPROVED 2026-08-17 (step 4)** — ⚠ **approved with gate step 3 (QA review) NOT RUN, stated before the approval and accepted**; step 5 recorded (`backend-state.md` updated for the changed surface). ⚠ **PROGRESS.md is 143 KB against the <60 KB target — a rotation is OWED and was deliberately not folded into this commit** ([[progress-md-record-step-rotation-is-chronically-skipped]]) · ⭐ **Resume point for a new session: [dm5-handoff.md](../progress/dm5-handoff.md) §13** | ✅ DM4: 5 migrations `20260926000100`–`000500` · pgTAP `340` | ✅ DM4: pgTAP **191f/6231** · 391==391 · vitest 1264 · 4 ARMs HOLD · matrix **18/18 RED-PROVEN** · `e2e:prod` **99p/0f** | ✅ DM4 **APPROVED (r2)** [review](../reviews/dm4-referrals-review.md), no binding condition | ✅ **2026-08-14** (DM4) | 2026-08-14 | `phase(DM4)` on `main`. ⛔⛔ **THE "NOT pushed / no `db push`" CLAIM THAT USED TO SIT HERE IS FALSE — CORRECTED 2026-08-17, MEASURED.** `origin/main` is `23b1d9cf` (a DM5·S5 commit), and `supabase migration list --linked` shows the remote carrying **every migration through `20260927000360`** ⇒ **DM1–DM5·S3 ARE LIVE ON THE REMOTE.** ⚠ **RE-MEASURED 2026-08-17 (later): the local-only set is FIVE, not the "two" this row carried** — `20260927000400` (S4 retirement) · `20260928000100` (recusal) · `20260928000200` (evidence-table revoke) · `20260928000400` (D4 evidence contract) · `20260928000500` (finalize-atomic). ⚠ `20260928000300` **does not exist** — it was the D11 inflow, reverted at `5b40d62b`; the sequence gap is expected. ⭐ *The "two" was already stale when written: the same batch that introduced the correction added three more migrations after it.* ⇒ (a) applied migrations may **NOT** be edited in place; (b) **S4's retirement never reached the remote**, so ADR 0120 **D9**'s byte-first ordering is owed against a **live remote** — ✅ **now quantified 2026-08-17**: all 12 bucket rows live there, `printed-documents` **4** (three PHI-tier) + `controlled-documents` **3**, so S4's data guard **will abort the next `db push`** naming both (correct by design; delete by manifest FIRST); (c) ✅ **REMOTE FLAG STATE MEASURED 2026-08-17 — and the premise was WRONG AT ITS GRAIN.** All **six** DM flags are OFF remotely (not "five"), **but of the 52 document functions 51 read NO flag (exactly one does) and ZERO RLS policies consult one** (direction CORRECTED at S6 QA 2026-08-17 — this row and two siblings carried it inverted; source FUP-DM5-REMOTE-STATE-MEASURED) — it is an **app-layer** gate, not a DB boundary, so it never made a DEFINER door unreachable. **Re-grade on "the remote holds no data and no users"** (0 orgs / profiles / commissions / cases) — stronger, but it **expires when the pilot loads data**. Full record: **FUP-DM5-REMOTE-STATE-MEASURED** in [follow-ups-open.md](../progress/follow-ups-open.md). ⛔ Does **not** settle CLOUD-ORPHAN-SURFACE (that is byte-orphans; this read metadata). Records: [DM1](../progress/dm1-substrate-cutover.md)·[DM2](../progress/dm2-orchestration-wave-a.md)·[DM3](../progress/dm3-controlled-documents.md)·[DM4](../progress/dm4-referrals.md)·**[DM5](../progress/dm5-wave-d-retirement.md)**. Open, refreshed 2026-08-17 (full prioritised list + why: **[handoff §13.2](../progress/dm5-handoff.md)**): ⬛ **FUP-DM4-RECUSAL ✅ CLOSED 2026-08-17** (`32054942` · `20260928000100` · ADR [0122](../decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md); PO overturned the Phase-19 deferral — a **narrowing** `can_read_case` arm raising `HC0DM` **above** the `p_kind` dispatch, so the sibling *narrative* arm is covered too; `340` plan 76→82, R5/R6 red-first `caught: HC077 / wanted: HC0DM`; lead-verified from `pg_get_functiondef`, guard at body line 24 vs dispatch at 29). ⚠⚠ **NOT ON THE REMOTE — `20260928000100` is local-only, so the hole is still OPEN there and closes only on `db push`. Do not read the ⬛ as "safe in production."** · 🔴 **FUP-DM5-NO-ANSWER-VS-NOTHING** (one class, **6 instances**; *an observable proxy substituted for the property that matters, always failing reassuring*) · 🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** (68 PHI-tier files) · 🟠 **FUP-DM5-DISPOSAL-JOB** (**the job does not exist**; runbook-mitigated; blocking pre-pilot) · 🟠 **FUP-DM5-CLOUD-ORPHAN-SURFACE** + 🟠 **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** (the count comparison — the only control surviving on Cloud — **passed over a diverged bucket and left a real byte behind**; S3 endpoint UNPROBED) · 🟠 FUP-DM5-STORAGE-ORPHANS (**Cloud half only** — local closed *empty by measurement*) · 🟠 FUP-DM5-STACK-CYCLE-DESTROYS-BYTES · 🟠 SETLOCAL-MIGRATION · ⬛ **FINALIZE-ATOMIC ✅ CLOSED 2026-08-17** (`20260928000500`: `complete_evidence_upload_verification` delegates to the byte verifier and mints the evidence row in ONE transaction; `341` plan 57→67 block J. ⭐ **the obvious keystone was VACUOUS** — one RPC call is one transaction, so any raise rolls back whatever the check order is; J2 CONSTRUCTS the orphan on the old path and J4 shows the identical fixture cannot reach it) · 🟠 SIBLING-GUARD-DIFF · ⬛ **330-WRITE-BLIND ✅ CLOSED 2026-08-17** (`330` plan 57→62 block W; blindness **re-derived** from the live catalog and still real — opening the arm left all 57 green; W3 pins the approver who READS but must not WRITE) · 🔴 D11-SUPERSEDED-NEVER-RETIRES → **superseded by FUP-DM5-SUPERSEDE-SERVING-COLLISION** · 🔴 FUP-PGTAP-VACUOUS · 🔴 FUP-AUTHZ-HARNESS-TRANSACTIONAL · ⬛ **GRANTS ✅ CLOSED 2026-08-17** (`20260928000200` revokes direct write on `rca_evidence`/`capa_action_evidence`; `341` plan 53→57 H1–H4; ⭐ the fix would have made **two P0 policies silently BLIND** — `252` now restores the grant *in its own rolled-back transaction* to keep them mutation-proven; opening both still reds exactly tests 1 and 14) · ⬛ **ADR 0121 ✅ ACCEPTED** (PO ratified D2 cron mechanism + D4 evidence contract 2026-08-17) · ⛔ **D11 INFLOW BUILT THEN ✅ REVERTED** (`5b40d62b` reverts `20260928000300`; `342` back to plan 59). **The gate caught what review did not:** `312` t38 (*"a revoked document still SERVES"*) died `documento descartado` — `app.resolve_document_version_bytes:72` refuses on `disposal_state <> 'none'`, **any** non-`none` state, so marking a superseded print `disposal_pending` **stopped its PDF opening the instant a document was re-issued**, colliding with ADR 0120 **D6/D8** (states change the overlay STAMP, never reachability). ⭐ **The collision is one value wide and both sides are right** — refusing to serve is correct for `subject_request`/`retention_expired`, wrong for `superseded`. ⛔ **PO decision → FUP-DM5-SUPERSEDE-SERVING-COLLISION** (🔴). ⚠ S3p was mutation-proven both ways and stayed GREEN: it asserted the **inflow** and never asked whether any **reader** still worked — the blast radius was one join away · 🔵 **D4 EVIDENCE CONTRACT ✅ BUILT** (`20260928000400`; `disposed` now records `byte_proof` + `metadata_source`, closed vocabulary, ACL restored + asserted after the DROP+CREATE) · ⬛ **ADR 0121 D1 VIOLATION ✅ DISCHARGED 2026-08-17** — the choice it posed (build the D2 job or revert the inflow) was taken as **revert**; the tree no longer carries an inflow with no outflow. ⚠ **The D2 job still does not exist** (`FUP-DM5-DISPOSAL-JOB`, 🟠, blocking pre-pilot) and rebuilding D11 is now blocked on the serving collision above, not on D1. Still owed whenever the job lands: a D4 **keystone** (behaviour is probe-verified, not gated) and a rewrite of `343`, whose K6b *"no scheduler exists at all"* becomes a **false pin** that day · 🟠 **NEW FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — `ARM=census` printed *"no unswept newcomer"* and passed while the new DEFINER door `complete_evidence_upload_verification` was **absent from the findings md**: the census's DEFINER clause is bounded to `bool` returns, so a `jsonb` command door is outside its domain, while the **door sweep's** domain includes exactly that shape. Coverage, not a vulnerability (service_role-only; `341` J7 pins it) · ⬛ **7 stranded remote objects ✅ DELETED 2026-08-17** (printed-documents 4 incl. 3 PHI-tier + controlled-documents 3; PO-authorized; a remote *reset* was declined as the wrong tool — it leaves storage behind and orphans it; all EIGHT S4 retirement buckets now empty ⇒ `20260927000400` **is pushable**) · ⬛ **form-assets' 38 stranded objects ✅ DELETED 2026-08-17** (PO-authorized; remote storage now **12 buckets / 0 objects**). ⛔ **A hazard came out of it, recorded in the runbook §3 step B:** `supabase storage rm -r ss:///<bucket>` deleted the **BUCKET ITSELF** (restored from `baseline.sql`) — and its RLS policies **survive on `storage.objects`**, so `pg_policies` still shows a healthy policy set for a bucket that no longer exists. Same hour, opposite direction: without `--yes` the command deletes **NOTHING** and still **exits 0** · 🟡 MANIFEST-FLAG/DVF-FILEOBJ/DEAD-CORE-PROJECTION/DANGLING-PRINT/Q1-OPEN-BYTES-CUT · 🟡 FUP-DM4-PRODROW. **PO decisions still owed:** ADR 0114 O1/O2/O4 + S1-O3, FUP-DM5-D11, and whether **ADR 0120 D9** needs a Cloud-verification amendment (open in the ADR, for S6). Census blind class = **141** at HEAD (not 146/150) — cite the query beside the number |
```

## ↩ Rotated from PROGRESS.md 2026-08-18 (the §6-step-5 Record) — the ENTIRE live DM5 phase section, VERBATIM

**DM5 closed on 2026-08-18** when the PO ruled all seven gate-step-4 decisions. Per CLAUDE.md §7 and
the §6 Record step, *"the completed phase's task detail is archived and replaced by a one-line
pointer"* — this is that archive. It is **34.5 KB**, and it sat inside a **47 KB** section of a
**146 KB** PROGRESS.md, against §7's *"well under 60 KB"* target.

⚠ **Appended BEFORE the cut and `cmp`-verified byte-identical, then the 19 relative links
`](docs/…)` were repointed to `](../…)`**, because a root-relative link copied from PROGRESS.md
**404s from `docs/progress/`**. Prose verbatim, link targets repointed. *(The same pass found **18**
such links already broken in `test-run-archive.md` from earlier rotations that skipped this step —
fixed there too. A verbatim rotation that does not repoint is the standing defect in this repo's
rotation discipline, not a one-off.)*

⛔ **What did NOT rotate, deliberately:** the two live obligations — **Critical FUP C1** (the
unrehearsed PHI-disposal runbook) and **C2** (the 407-door Tier 1 sweep) — stay in PROGRESS.md §
Critical FUP, which is never rotated at any size. Nothing in this archive supersedes them.

---

### 🔵 IN PROGRESS — **DM5: Wave D + retirement** (opened 2026-08-14) — the program's FINAL phase

> **Full detail → [dm5-wave-d-retirement.md](../progress/dm5-wave-d-retirement.md)** ·
> ⛔ **NEXT-SESSION RESUME POINT = the 🛑 START HERE block directly above — but read it for its
> *"What the next session works in"* list, NOT for the docket, which is ANSWERED as of 2026-08-18.**
> *(This pointer's target has now changed meaning three times without the pointer changing —
> **a resume pointer goes stale every time the thing it points at completes**, which is exactly when
> nobody re-reads it.)* ⚠ **The two live obligations are in
> [§ Critical FUP](../../PROGRESS.md#-critical-fup--the-must-not-be-forgotten-list), not here.**
> ⚠ **[dm5-handoff.md](../progress/dm5-handoff.md) §13 is now DISCHARGED HISTORY** — it
> briefs a session resuming **S4/S5**, and every slice it describes as pending is closed. Read it only
> for the environment traps in §13.4 and the mutation-harness incident in §6. *(This pointer read
> "§§9–11" until 2026-08-17 and then "§13" until S6 closed — **a resume pointer goes stale every time
> the thing it points at completes**, which is exactly when nobody re-reads it.)* ·
> plan [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md) · ADRs
> **[0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D18) +
> **[0121](../decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)** (disposal lifecycle,
> ACCEPTED) + **[0122](../decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)**
> (recusal arm) · step 0 [dm5-surface-verification.md](../progress/dm5-surface-verification.md).
> Window `20260927000100`+ · flag `documents_wave_d` · pgTAP **`341`** (S2) + **`342`** (S3) +
> **`343`** (S5 disposal gap — ⚠ its **K6b asserts "no scheduler exists at all"**, TRUE today and a
> **false pin** the day the D2 job lands; rewrite `343` in the same slice, not after).
> ⚠ The phase narrative — the three mis-pinned catalog facts, the six enumeration-boundary repeats and
> the S2 close-then-reopen history — rotated to the record **2026-08-14**. **Those lessons are the
> phase's most valuable artifact; the record, not this section, is where they live.**
>
> **Slices:** **S0 ✅** manifest tool (`0e85cbe7`, `9d37ad79`; baseline self-labels **DEGENERATE**, not
> S4 input) · ~~S1~~ ⛔ **WITHDRAWN, never built** (D3/D4/D5 struck → **D11**) · **S2 ✅** NSP RCA/CAPA
> evidence · **S3 ✅ COMPLETE — all four gate steps** (2026-08-14) · **S4 ✅ COMPLETE — all five gate
> steps** (built 2026-08-16 **PO-authorized on the day**, closed 2026-08-17; QA r1 ⛔ → r2 ⛔ → **r3 ✅**)
> · **S5 ✅ COMPLETE — all five gate steps** (2026-08-17) — operational closure, carrying **S5.R**
> (byte-path rehearsal, PO-directed same day), **S5.D** (disposal runbook + the gap pinned on both
> sides), the backup/restore drill and the EXPLAIN baselines. **Step 2 ✅ discharged** by the follow-up
> batch's `e2e:prod`, which the PO ruled would ride S5's owed run; **step 4 ✅ PO-RULED 2026-08-17 —
> the batch's approval closes S5 too** · **FOLLOW-UP BATCH ✅ gate green, PO-approved 2026-08-17**
> (`fd69d4be`) · **S6 🔵 IN PROGRESS** — opened 2026-08-17 after the pre-S6 follow-up batch
> (`496fd135`). Build work **done**; **step 3 QA ✅ r2 APPROVED 2026-08-17** (r1 ⛔ → fixes → r2);
> gate steps 2 + 4 **owed**.
>
> ### 🔵 S6 — canon rewrite + program exit sweep (opened 2026-08-17) — **steps 1–3 ✅ COMPLETE · step 4 (PO) OWED** — slice QA ✅ r2 · **DM5 PHASE QA ✅ APPROVED r2**
>
> **Preceded by a pre-S6 follow-up batch (`496fd135`)** — census re-scoped, P4 measured, 478 links
> repointed. Detail in the follow-ups register and the S5 record.
>
> **Built:**
> - **ARCHITECTURE.md Rule 1** — the RLS count read *"146/146 as of 2026-07-27"* and was **stale by
>   19 tables**; now **165/165 measured**, with the deriving SQL inline. Plus **D8's Rule-1
>   sharpening** as the rule's **fourth** pattern (ADR 0114 D8, owed to the canon since DM1):
>   **RLS is the boundary for document METADATA; for BYTES it is not the boundary at all** — the two
>   document buckets carry INSERT policies only, and `open_document_version` is the whole boundary.
>   *A policy-shaped audit reads "no read policy ⇒ unreadable", which is exactly backwards.*
> - **ARCHITECTURE.md §2** — the **document model was entirely absent from the canonical schema**
>   though the program had shipped it. 13 tables added, columns derived from `pg_attribute`, not
>   migration text.
> - **ARCHITECTURE.md Rule 9** — the missing documents-module exception, owed since **DM2 QA r1
>   INFO-4** and carried across four slices. Until now the canon and QA-accepted practice
>   **contradicted each other**.
> - **`docs/backend-state.md`** — the currency stamp (*"stale by three slices … registry 391→407"*,
>   itself stale) replaced by a measured **DM END STATE** block: registry **411==411**, 13 tables /
>   1 policy each, **38** document doors (5 service-role-only), 4 buckets, `storage.objects` **3
>   INSERT + 1 SELECT**. The **"census 146 vs 141"** disagreement is resolved — it was a **missing
>   SCHEMA BOUND**, not a wrong number (**141** `public`, **145** `app`+`public`); the old
>   *"(273 signatures)"* does not reproduce and is retired. Every figure carries its query.
>
> **Exit sweep — bounded by IDENTIFIER (`storage_path`, `storage_bucket`, bucket literals,
> `createSignedUrl`), never by directory or call syntax: ✅ CLEAN.** All 28 retired-bucket literals
> in `src/`+`e2e/` are **comments**; the one apparent live hit is `domId: "interview-attachments"`,
> an HTML anchor, not a bucket. The only live hardcoded bucket literal is `.from('form-assets')`×2 —
> surviving and out of scope (D13). Every document-model bucket reference is **derived** from
> `storage_bucket`. ⛔ **Not covered:** `supabase/` SQL was not swept by this pass.
> ⚠ **Bound disclosure (S6 QA F4):** the 28 reproduces **only** over the 7 hyphenated retired-bucket
> names — the bare name `attachments` was excluded (it is also a feature-flag key and a module name)
> and appears **live ×3** as `featureEnabled('attachments')`, which are flag keys, not bucket
> references (the `case_patient` collision class). The exclusion was right; its silence was the
> defect. ✅ **The `supabase/` hole was closed by QA at the catalog layer** (the only layer that
> executes): quote-bounded retired-bucket literals in `pg_get_functiondef` over every `app`+`public`
> function and in `pg_policies` → **0 and 0**.
>
> ⭐⭐ **THE SWEEP'S REAL YIELD — it falsified a canon sentence I had written an hour earlier.**
> Rule 9's first draft said the exception was **ONE** module and that *"a second would break ADR 0114
> D8's singularity"*. **Both halves were false.** There are **TWO** signers — `documents/actions.ts`
> and `referrals/actions.ts` (DM4, ADR-cited in its own header) — and **D8's singularity is a
> DB-KERNEL property, not a TS-module one**: `open_document_version` and `open_printed_document`
> both delegate to `app.resolve_document_version_bytes` (D12 composition), while
> `open_referral_snapshot_document` deliberately does **not**. Conflating the two layers is what
> produced the false sentence. ⚠ **Consequence that outlives S6:** the referral door sits **outside
> the byte kernel**, so kernel-level gates do **not** automatically cover it — directly relevant to
> 🔴 `FUP-DM5-SUPERSEDE-SERVING-COLLISION`, which is a `resolve_document_version_bytes` finding.
> A **third** signer now needs a ruling; the list is exhaustive by intent.
>
> **Gate step 1 — ✅ GREEN (2026-08-17), on a fresh `db reset`:**
>
> | check | result |
> |---|---|
> | pgTAP | **194 files / 6392 PASS**, exit 0 |
> | vitest | **89 files / 1304 passed**, exit 0 |
> | lint (5 chained) | **exit 0** — eslint 0/0, css-vars, memberships-door, client-server-imports, vacuous (185 spec files, 0 findings) |
> | typecheck | **exit 0** |
> | `next build` | **exit 0** — compiled, **19/19** static pages |
> | authz, **named by ARM** | `ARM=census` *has anything ever asked?* **546 live / 570 verdicts** · `ARM=hat` *does a door read `memberships` hatless?* **3, all reasoned-allowlisted** · `ARM=floor` *is every door called?* **74 never-called, all allowlisted, every entry resolves** · `FROMFINDINGS=1 ARM=wrapper` **BLIND 41 ⊆ allowlist** — all four **HOLD** |
> | diff-scoped `ARM=policy` | **NOT APPLICABLE — measured, not asserted**: **0** migrations, **0** policy statements, **0** `prosecdef` changes in the S6 diff |
>
> ⚠ **S6 changed ZERO `src/` files** (diff = `ARCHITECTURE.md` · `PROGRESS.md` · `docs/backend-state.md`),
> so `next build` could not be affected — **it was run anyway rather than argued away**, because
> *an omission that happens to be harmless is still an omission* (the S5 QA r1 MINOR-1 lesson).
>
> **Gate step 3 — ✅ QA r2 APPROVED 2026-08-17**
> ([review](../reviews/dm5-s6-review.md)). **r1 ⛔ CHANGES REQUESTED: six findings,
> ALL record defects** (the DM5 pattern unbroken — no code change requested in any round):
> **F1** the END STATE block **INVERTED** its source measurement ("51 of 52 read a flag" — the
> source says 51 do NOT; fixed in all THREE places it sat) · **F2** §2 ended the `upload_state`
> machine at `active`, a state the CHECK has **never contained** (`'active'` is `documents.status`) ·
> **F3** the "servable predicate" claimed `deleted_at is null` — enforced **nowhere** on the byte
> path · **F4** the sweep's undisclosed bound (above) · **F5** Rule 9's "doors return IDs only" is
> false for `open_printed_document` since ADR 0120 D7/D12 · **F6** the "full document-surface
> rewrite" promise left contradicting the delivered END-STATE-block scope. All six **fixed
> same-day**; QA **re-measured gate step 1 in full** on a fresh reset (pgTAP 194f/6392 · vitest
> 89f/1304 · lint 5/5 · tsc 0 · census 546/570 · hat 3 · floor 74 · wrapper 41 ⊆ allowlist — every
> figure reproduced) and independently re-derived **every** measured claim in the S6 diff against
> the live catalog (all reproduced; census table in the review). ⚠ **The r2 APPROVED is the S6
> SLICE verdict only.**
>
> **Gate step 2 — ✅ GREEN 2026-08-17** (second full `e2e:prod`, `REBUILD=1`, after the fix):
> **1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches**, the parts
> summing to exactly **1129 collected** — reconciled **per batch** (`accounted N/N`, `0 did-not-run`
> in all 18), so **no unrun tests**; the [[gate-summary-can-hide-unrun-tests]] shape was looked for and
> is absent. **Batch 4 = 64 passed / 0 failed** (was 63/1) and `ok 13 … dm5-nsp-evidence.spec.ts:388:5
> › EVID-KBD-1`. The **2 flaky are exactly the two remaining `FUP-E2E-REPEAT-FLAKY` members**
> (`act-role-assumption:157`, `phase2-auth-shell:268`) — EVID-KBD-1 is **not** among them, so it did
> not merely degrade from failed to flaky. 3 INFRA re-runs, final **0 infra**.
>
> ⛔ **The FIRST full run was RED, and that is kept rather than overwritten** — 1120p / **1f** /
> 2 flaky / 0 did-not-run, failing on **BUG-DM5-S6-EVID-KBD-1** (Bug Log, now ⬛ closed with its root
> cause). It was characterised over 4 runs at `RETRIES=0` — reproducible **2/2** at batch-4
> composition, green alone (8/8) and paired (18/18) — which is what proved it a real
> composition-dependent defect rather than the flake it was filed as. **Not an S6 regression:** 0
> `src/` files and 0 migrations separated that red run from the preceding green one.
> ⚠⚠ **Two traps from this step, both worth keeping.** (1) **The harness exit code lied**: the
> background job reported **exit 0** because the invocation ended in an `echo`, while the gate printed
> **GATE RED** with `E2E_PROD_EXIT=1` — *read the gate's own verdict, never the wrapper's status.*
> (2) **A line-keyed grep went stale mid-slice**: the fix moved the test `:347` → `:388`, so searching
> `:347` in the green log returns **nothing**, which reads exactly like *"the test did not run."*
>
> ⛔ **Step 4 OWED; DM5's PHASE QA not run** — and
> S3/S4/S5/**S6** verdicts are SLICE verdicts authorizing no part of it. 🔒 **The UNREHEARSED runbook still
> binds and S6 may not close over it.** 🔴 The supersede-serving collision is **deferred, not
> closed**. **ADR 0120 D9's Cloud question was PO-deferred "to when S6 reaches it" — S6 has now
> reached it: it MUST be put to the PO at step 4** (with ADR 0114 O1/O2/O4, S1-O3, FUP-DM5-D11,
> and the two new QA hand-offs: F6's per-slice-sections ownership question and F3's unmeasured
> `active`+`deleted_at` corner).
>
> ### ✅ FOLLOW-UP BATCH — gate GREEN, PO-approved 2026-08-17 (`fd69d4be`) — **added here 2026-08-17; the section had no record of it at all**
>
> ⛔ **This block is the section's own headline defect, caught one more time.** 22 commits
> (`c9c0fb3a`…`fd69d4be`) landed a follow-up batch, a full gate ran GREEN, and the PO approved it —
> while every marker in this section still read *"S5 ⏸ NOT CLOSED: step 2 PO-DEFERRED, step 4 owed."*
> The warning six lines below, added the same day, says **a marker moves while the status line does
> not**; it was written and then immediately re-earned. → [[progress-md-record-step-rotation-is-chronically-skipped]].
>
> **Gate at `4f16ea5f`** — ✅ **still valid at HEAD `fd69d4be`: the only commits after it are
> docs-only** (`git diff --name-only 4f16ea5f..HEAD` = `PROGRESS.md` + 2 `docs/` files, verified, not assumed).
>
> | step | figure |
> |---|---|
> | 1 — build | registry **412 == 412** · pgTAP **194 files / 6392 PASS** (fresh reset) · lint **5/5** · tsc **0** · vitest **89 files / 1304** |
> | 1 — authz, **named by ARM, never by script** | `ARM=census` *has anything ever asked?* **546 live / 570 verdicts** · `ARM=hat` *does a door read `memberships` without the caller's hat?* **3, all reasoned-allowlisted** · `ARM=floor` *is every door called?* **74 never-called, all allowlisted, every entry resolves** · `FROMFINDINGS=1 ARM=wrapper` **BLIND 41 ⊆ allowlist** |
> | 1 — diff-scoped `ARM=policy` | **NOT APPLICABLE — argued and MEASURED, never "clean"**: policies **274** unchanged, no migration in the diff contains a policy statement |
> | 2 — `e2e:prod` | ✅ **GATE GREEN: 1118 passed · 0 failed · 0 did-not-run · 5 flaky · 6 skipped · 18 batches** |
> | 3 — QA | ⛔ **NOT RUN** |
> | 4 — PO | ✅ **APPROVED**, with the step-3 deviation stated *before* the approval and accepted |
> | 5 — record | ✅ `docs/backend-state.md` updated (the backend surface **did** change) |
>
> ⭐ **The coverage line read `1123 of 1129` and was CHECKED, not accepted** — all 18 batches reconcile
> `accounted N/N` and sum to 1129; the 6 are skips, which the pass/fail/flaky tally excludes. **No
> unrun tests**; the [[gate-summary-can-hide-unrun-tests]] shape was looked for and is absent.
> ⚠ **4 INFRA re-runs, one a NEW shape worth the name: batch 8 crashed with exit 127 and no summary
> at all — 40 tests unrun.** Exit 127 is *command not found*, not a test failure; re-run to 40/40.
>
> **Closed by the batch:** ⬛ FUP-DM4-RECUSAL (ADR 0122) · ⬛ FUP-DM5-FINALIZE-ATOMIC · ⬛
> FUP-DM5-330-WRITE-BLIND · ⬛ FUP-DM5-GRANTS · ⬛ FUP-AUTHZ-ALLOWLIST-ROT · ⬛ FUP-DM5-MANIFEST-FLAG ·
> ⬛ FUP-DM5-DEAD-CORE-PROJECTION · ⬛ FUP-DM5-342-PLAN-COMMENT. **Reverted:** the D11 inflow
> (`5b40d62b`). **Two new findings:** 🔴 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** · 🟠
> **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT**.
>
> ⚠ **`ARM=census` PASSED while a brand-new DEFINER door was absent from the findings file.** Its
> DEFINER clause is bounded to **`bool`** returns and `complete_evidence_upload_verification` returns
> **`jsonb`**, so the door was in no arm's domain — the *door sweep's* domain includes exactly that
> shape. Coverage gap, **not** a vulnerability (service_role-only; `341` J7 pins it). This is
> [[enumeration-boundary-is-a-syntax-not-a-property]] again, and it is why the gate row above names
> the ARM's **question** rather than the script.
>
> ✅ **THE ONE THING THE BATCH LEFT UNSETTLED — ASKED AND RULED 2026-08-17.** The PO ruled the
> follow-ups be grouped into **one** gate *riding S5's already-owed `e2e:prod`*, so S5's step 2 is
> discharged by the run above; but the step-4 approval was recorded against **the batch**
> (`phase(DM5-followups): complete`) and said nothing about S5. Put to the PO rather than assumed in
> either direction — **ruling: the batch's approval closes S5 as well.** S5 is therefore **COMPLETE,
> all five gate steps** (1 ✅ · 2 ✅ · 3 ✅ r2 · 4 ✅ · 5 ✅).
> ⭐ *Worth keeping as method: the ambiguity was invisible from either document alone — the batch
> record was complete about the batch and silent about what else the approval reached. **An approval's
> SCOPE is a fact about the approval, and it has to be written down like any other.***
>
> ### ✅ S5 CLOSED 2026-08-17 — operational closure — all five gate steps, QA **APPROVED (r2)**
>
> **Gate: step 1 ✅ · step 2 ✅** (discharged by the follow-up batch's shared `e2e:prod`, which the PO
> ruled would ride S5's owed run) **· step 3 ✅ APPROVED (r2) · step 4 ✅ PO-RULED 2026-08-17** — the
> batch's approval closes S5 too (asked, not assumed; see the ✅ note at the end of the batch block).
> ⚠ **A SLICE closure — DM5's PHASE QA is still owed at S6**, and S5's r2 authorizes no part of it.
>
> **Delivered:** **S5.R** byte-path rehearsal · **S5.D** disposal runbook
> (`docs/deployment/phi-disposal-runbook.md`; owner = **the PO**, executor = whoever holds
> service-role reach, **monthly + out-of-band on a data-subject request**) with the gap pinned on
> **both** sides (`343` + `disposal-gap.test.ts`, both observed RED) · backup/restore drill of DB +
> Storage together · EXPLAIN baselines. Full record →
> **[dm5-s5-operational-closure.md](../progress/dm5-s5-operational-closure.md)**; QA r2 review
> `docs/reviews/dm5-s5-review-r2.md`.
>
> 🔒 **Two gaps were adopted as BINDING — ⭕ 2026-08-17 (pre-S6) ONE IS DISCHARGED, ONE STILL BINDS:**
> ⬛ **P4 `open_document_version` — MEASURED 2026-08-17**, by *meeting* the prerequisite rather than
> fabricating the row the write path refused: the real `begin → finalize → complete_verification`
> corridor, then EXPLAIN in a rolled-back transaction. **8.2 ms cold · 3.8–4.0 ms warm · 121 buffers
> warm**, single-row at stated N, no residue. The original ruling (*a fabricated baseline is worse
> than a missing one*) is what made this close cleanly. ⚠ **Baseline only — NO volume arm**, so
> nothing here says how it scales. · 🔒 **The runbook sequence is UNREHEARSED — STILL BINDING, S6
> may NOT close over it.** *Naming an owner is not a rehearsal, and writing a runbook is not running
> it* — it needs the PO (its owner) plus service-role reach, so it was never the lead's to discharge.
> ⛔ **20 NOT-COVERED items** (⭕ **not 13 — recounted at the phase QA 2026-08-17; the "13" was right
> when written, never updated as r2 residuals were appended, and the appends landed out of numeric
> order so the tail does not look like a tail**) are enumerated in the record under its binding heading — **read them
> before S6**, because a close that omits them reads as completeness.
>
> ⭐ **The three findings worth more than the slice**, kept here because they are cross-phase and the
> record is where the detail lives: a **restore onto a bare Postgres reported SUCCESS while losing 67%
> of RLS** (psql exit 0 · 490 true errors · **90 of 274 policies** — two false signals aligned, and
> only a *catalog comparison* exposed it) · **a Storage backup IS a PHI export** (68 PHI-tier files in
> plaintext) · and **`capture` called a destroyed-bytes bucket CLEAN**, non-monotonically — partial
> byte loss dirty, **total** byte loss clean.
>
> ### ✅ S4 CLOSED 2026-08-17 — legacy bucket retirement — all five gate steps, QA **APPROVED (r3)**
>
> QA r1 ⛔ → r2 ⛔ → **r3 ✅** (0 P0 · 0 MAJOR); PO approved the slice on the day. ⚠ **A SLICE verdict —
> DM5's phase QA is still owed at S6, and it authorizes no part of S5.** Built: migration
> **`20260927000400`** (drops the last 4 retirement-bucket policies + the 8 bucket rows, behind a
> guard that **refuses** to retire a bucket still holding `storage.objects` rows — D9's byte-first
> ordering encoded executably) · pgTAP **`325`** 5 → 8. Survivors: `documents-standard`/`documents-phi`
> + `form-assets`/`meeting-audio`. Detail → **[the DM5 record](../progress/dm5-wave-d-retirement.md)
> § S4**; reviews [r3](../reviews/dm5-s4-review-r3.md) · [r2](../reviews/dm5-s4-review-r2.md) ·
> [r1](../reviews/dm5-s4-review.md).
>
> ⛔ **THE BYTE HALF WAS A NO-OP, AND IS RECORDED AS THAT — NOT AS "RETIREMENT PROVEN".** Every
> retirement-bucket byte was already an orphan with no metadata row, so the Storage API — the D9
> *gate* — could not address one of them; `delete --execute` never ran. What S4 closed is the
> metadata/schema half. ⛔ **Not relieved by the approval: Cloud is UNVERIFIED in all three rounds,
> and the deploy-time byte path is UNREHEARSED.**
>
> ⭐⭐ **The lesson that outlived the slice: broken assertions fail in OPPOSITE directions and only one
> direction announces itself.** A reference sweep bounded by one property missed a breakage living in
> another; pgTAP then returned 4 reds — but **two Rule 6 *"NO update/delete policy"* pins went
> VACUOUS**, satisfied forever by zero policies, sitting in the passing column of a green suite.
> **Fixing only what the suite reports would have left two dead pins reading as coverage.**
> → [[removing-a-subject-breaks-its-assertions-in-two-directions]]
>
> ### ✅ S3 CLOSED 2026-08-14 — printed renditions onto the substrate — all four gate steps, QA **APPROVED (r2)**
>
> QA r1 ⛔ (2 MAJOR blocking) → **r2 ✅** (`801a2589`, [review](../reviews/dm5-s3-review.md)) — **every
> blocking item re-proved by neutralization, not read.** Safety: 8 mutation-bearing runs, every one a
> rolled-back transaction, degenerate bodies **0** after each. ⛔ **A slice verdict, not the phase
> gate.** Detail → **[the DM5 record](../progress/dm5-wave-d-retirement.md) § S3**.
>
> ⭐ **The corridor EXECUTES — the one thing no static gate could say.** `pdf-printing` **9/9** and
> `pdf-printing-meetings` **6/6**: real `%PDF-` bytes, mint → download → public verify → revoke →
> overlay → re-verify. **S2 passed every static gate while its feature did not work at all.**
> ⚠ Requires the **Gotenberg sidecar** (`docker start gotenberg-pdf`, `/health` 200 on :3010) **and
> `--workers=1`** — without it the corridor specs fail as uniform login errors that read as product
> defects. → [[print-corridor-needs-a-sidecar-no-gate-starts]]
>
> ### 📌 Open follow-ups — refreshed 2026-08-17, **this list is the live one**
>
> Full text + why each matters: **[follow-ups-open.md](../progress/follow-ups-open.md)**; prioritised order
> with reasoning: **[handoff §13.2](../progress/dm5-handoff.md)**.
>
> **🔴** **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ⏸ **PO RULED 2026-08-17: decide later, the D11 inflow
> STAYS REVERTED.** Both options declined for now (widen `app.resolve_document_version_bytes` for
> `superseded`, or reinterpret ADR 0121 D3/D5). ⛔ **A deferral is not a closure: the item stays 🔴, S6
> may NOT close over it, and D11 cannot be rebuilt until it is decided.** ⚠ **`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES`
> is this same deferral from the other side** — not independent work. The reverted state is coherent
> (no inflow without outflow, no unservable prints); *a narrowing can be wrong and safe, a widening
> cannot* ·
> **FUP-DM5-NO-ANSWER-VS-NOTHING** (a **CLASS**, 6 instances; *an observable proxy substituted for the
> property that matters, always failing in the reassuring direction* — instances 4, 5 and 6 were each
> found **inside the fix for an earlier one**) · **FUP-DM5-BACKUP-IS-PHI-EXPORT** ·
> **FUP-PGTAP-VACUOUS** (`lint:vacuous` scans TS only; ~6000 pgTAP assertions unscanned, live specimen
> found) · **FUP-AUTHZ-HARNESS-TRANSACTIONAL** (⛔ **read the record's incident section before running
> ANY mutation harness** — a live authz gate was left OPEN on the shared stack).
>
> **🟠** **FUP-DM5-DISPOSAL-JOB** (**the job does not exist**; blocking pre-pilot; ADR 0121 **D2**'s
> obvious design does not work — the Storage API is unreachable from SQL, so a pure-SQL `pg_cron` job
> automates only the half that was never the gap) · **FUP-DM5-CLOUD-ORPHAN-SURFACE** +
> **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** (the pair deciding whether the deploy path can be
> certified at all; **the S3 endpoint is UNPROBED and probing it is the single measurement that could
> change this**) · **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** (⭕ **RE-SCOPED 2026-08-17 pre-S6 — its filed
> premise was FALSE and the finding is bigger than filed.** No jsonb/void command door carries a
> verdict *anywhere*: the two names cited as proof of a "wider door-sweep domain" occur only in
> **prose**, which `verdicts_from_findings` — a **table-row** scraper — never reads. Measured:
> **407** reachable non-trigger command doors sit outside **every** arm's domain, **326** of them
> RPC-callable. ⭐ **A 3-door neutralization sample found all three COVERED**, so the class is
> **covered-but-UNPINNED, not blind** — the coverage is real, nothing records it, so nothing
> notices if it regresses and a NEW door in the class passes by absence. `ARM=census`'s printed
> claim was narrowed to its true domain. **Sizing the 407-door triage is a PO decision**; ⛔ the
> 3-door sample may NOT be used to close it) · FUP-DM5-STACK-CYCLE-DESTROYS-BYTES (mechanism still undetermined) · FUP-DM5-STORAGE-ORPHANS
> (**Cloud half only** — local closed *empty by measurement*) · FUP-DM5-SETLOCAL-MIGRATION (⛔ in-place
> fix **blocked**, the files are remote-applied; remaining remedy = a lint gate = **a PO decision**) ·
> FUP-DM5-SIBLING-GUARD-DIFF · FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES (**superseded by** the collision
> above).
>
> **🟡** FUP-ACL-APP-POPULATION (re-scoped: assertion **built**, the 237-function triage remains) ·
> FUP-DM5-DVF-FILEOBJ (latency rests on **caller discipline, not the schema** — nothing makes
> `file_object_id` unique) · FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT · FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN
> (fail-open half fixed; arm still a no-op pending a **NAMED** successor) · FUP-PGTAP-WORKER-DEADLOCK ·
> FUP-DM4-PRODROW (deferred to deploy).
>
> **PO decisions owed, easy to lose:** ADR 0114 **O1** (retention values) · **O2** (scanner +
> `unscanned_accepted` expiry) · **O4** (signed-URL TTL) · **S1-O3** (uploader visibility) ·
> **FUP-DM5-D11** ("decide later") · and whether **ADR 0120 D9** needs a Cloud-verification amendment
> (open in the ADR, for S6). ⛔ **None of these may be invented by an implementer.**
>
> ↩ **S5 / S4 / S3 narrative detail rotated 2026-08-17** (§6 step 5) → **[the DM5 record](../progress/dm5-wave-d-retirement.md)
> § "Rotated from PROGRESS.md 2026-08-17"**, appended and **`cmp`-verified byte-for-byte before the
> cut** (371 lines) — ⚠ **then one mechanical transform applied after that check: relative links
> `](../…)` → `](../…)`, because a root-relative link 404s from `docs/progress/`. Prose verbatim,
> link targets repointed.** ⚠ **An `APPROVED` slice is not an absence of gaps** — rotation *moved* the
> open lists, it did not settle them.
>

> ↩ **THE § STATE BLOCK WAS RESTORED LIVE TO PROGRESS.md ON 2026-08-18 AND IS NOT ARCHIVED HERE.**
> It rotated out with this phase section by mistake, and the mistake is worth naming: **State is
> cross-phase OPERATIONAL state — branch, `db push`, remote migration level, bucket counts — not
> completed-phase detail.** Two PROGRESS.md rows still pointed at it, so the rotation created a
> dangling pointer to the freshest facts in the file. ⭐ *A phase archive is the worst possible home
> for a claim about an external system: nothing re-reads it, so it goes stale silently* —
> [[a-records-claim-about-an-external-system-goes-stale-silently]]. **Read PROGRESS.md § State.**
## ↩ Rotated from PROGRESS.md 2026-08-18 — the SEVEN-DECISION DOCKET as it stood before the rulings, VERBATIM

The gate-step-4 docket that blocked DM5's closure, preserved with its **"why it blocks"** column —
which is the reasoning each 2026-08-18 ruling answers. **The rulings themselves are in PROGRESS.md
§ Decisions (the eight `2026-08-18` rows) and in the ADRs**; this is the question, not the answer.

⚠ **The docket was over-wide by one item**, and that is worth keeping visible: row 2 lists ADR 0114
**O4**, which had been **ruled on 2026-08-13** (ADR 0118 — 120 s / 300 s signed-URL TTLs). ADR 0120's
open-items section — the phase review's **own cited source** — named only O1 and O2. The review
widened its source, PROGRESS.md inherited it, and the PO was asked to decide something already
decided. ⭐ *An over-wide list of what is owed costs the same round as an under-wide one.*

⚠ Appended BEFORE the cut, `cmp`-verified, links repointed `](docs/…)` → `](../…)`.

> <details><summary>The docket as it stood 2026-08-17, before the rulings — kept because the "why it blocks" column is the reasoning each ruling answers</summary>

| # | decision | why it blocks | owner |
|---|---|---|---|
| **1** | **ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) D9 — the Cloud question**: amend D9 with a Cloud-specific verification step, **or** explicitly ratify the under-count class as **unverified** | PO-deferred *"to when S6 reaches it"* — **S6 has reached it.** The only control that survives on Cloud is **provably blind** to a both-ways-diverged bucket (constructible in 4 commands). ⚠ The S3 endpoint is **UNPROBED**, and probing it is the single measurement that could change the answer — so deciding blind is a real option, but it must be a *decision*, not a default | PO |
| **2** | **ADR [0114](../decisions/0114-document-model-redesign.md) O1 / O2 / O4** — retention values · scanner + `unscanned_accepted` expiry · signed-URL TTL | **O2 is the live one**: with no scanner integrated, every user upload currently rests at the interim state `unscanned_accepted`, by PO risk acceptance. That acceptance has no expiry until you set one | PO |
| **3** | **ADR 0114 S1-O3** — uploader visibility | Open since DM2·S1; a confidentiality-surface question no implementer may answer | PO |
| **4** | 🔴 **FUP-DM5-D11 / SUPERSEDE-SERVING-COLLISION** — widen `app.resolve_document_version_bytes` to serve `disposal_pending` bytes whose reason is `superseded`, **or** reinterpret ADR [0121](../decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) D3/D5 | PO ruled **"decide later, the inflow STAYS REVERTED"**. ⛔ **A deferral is not a closure: D11 CANNOT BE REBUILT until this is decided, and no slice may close over it.** *A narrowing can be wrong and safe; a widening cannot* — a PHI byte-serving gate is not widened unilaterally | PO |
| **5** | **Sizing the 407-door census triage** (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`) | **407** reachable command doors sit outside every authz arm's domain. A 3-door sample found all three **COVERED**, so this is **covered-but-UNPINNED, not blind** — but 407 is too many to classify honestly in one pass, and a backlog of generic reasons is itself a vacuous act. ⛔ **The sample may NOT be used to close it** | PO (+ lead/backend) |
| **6** | **The unwritten per-slice `backend-state.md` sections** (S2 / S3 / S5) — still wanted, and owned by whom? | Raised by the S6 QA (F6) and re-homed by the phase QA. Named explicitly so the obligation cannot die quietly when DM5 closes | PO |
| **7** | ⚠ **PILOT RISK ACCEPTANCE — may the pilot proceed over a manual-only, UNREHEARSED PHI-disposal path?** | 🔒 **The binding one.** DM5 ships a **known, runbook-mitigated PHI-disposal gap**: ADR 0121 **D2**'s job **does not exist**, so `disposal_state` records an **intent, not a destruction guarantee**, and bytes that should have been destroyed persist until a human runs the runbook — **which has never been executed end-to-end.** ⭐ This inverts ADR 0099 D10 (*"a stale row nobody looks at harms nobody"*): for PHI **the stale row IS the harm.** Rule 12 / LGPD. **A risk acceptance, not an engineering call** | PO |

> </details>
