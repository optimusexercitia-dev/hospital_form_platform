# E2E gating on a prod standalone build

**Status:** Recommendation · **Date:** 2026-07-11 · **Author:** lead session (form-builder
E2E spec-refresh task).
**Trigger:** running the full Playwright suite against a **prod standalone build** during
BUG-AIF-001 gate work surfaced (a) stale form-builder specs and (b) a latent app
regression — both invisible to the routine `next dev` gate.

This doc is the concrete operational companion to
[pre-pilot-foundations-program.md §7](../plans/pre-pilot-foundations-program.md) and ADR
[0057]. It does not change the plan; it makes the plan's already-stated prod-build E2E
discipline reproducible and explains *why dev-only gating is not sufficient*.

## TL;DR

`playwright.config.ts` boots `next dev` (`webServer: 'npm run dev'`,
`reuseExistingServer: !CI`). The routine green-bar therefore runs against the **dev**
compiler. Two independent classes of failure are structurally invisible that way, and
both bit us on 2026-07-11:

1. **Coverage drift** — specs that aren't in the routine run silently rot. The
   `ConditionBuilder`/FBE refactor renamed a checkbox (`Exibir somente sob condições` →
   context-dependent `Visibilidade condicional` / `Aparência Condicional`); 10 selectors
   across 5 builder specs broke. *(This class fails on dev too — it just wasn't being
   run.)*
2. **Prod-only behaviour** — some failures reproduce **only** on a prod build:
   - BUG-AIF-001 (App-Router `loading.tsx` + action→`router.refresh` deferred-flush
     stall on 16.2.9) — publish/refresh transitions intermittently hang.
   - The `client-import-server-query-module-breaks-build` and
     `rsc-server-fn-prop-client-crash` traps — green on `dev`/`tsc`/`vitest`, they
     **abort `next build`** or crash RSC at runtime on standalone prod.

   A dev-only gate cannot see any of these.

Separately, the prod run surfaced a real, **build-mode-independent** regression
(`answer-model-v2` DV-2 → BUG-AMV2-002, choice-default publish rejected `valor padrão
inválido`, fails identically on dev *and* prod). That one isn't prod-specific — it was
simply never being run. Both stories point to the same fix: **run the whole suite on a
prod build, periodically, and treat the result seriously.**

## The recipe (what actually works here)

The app is `output: 'standalone'` (`next.config`), so `next start` is wrong — it crashes
mid-run (memory `e2e-standalone-server-not-next-start`). Pre-start the prod server on
:3000 yourself; Playwright's `reuseExistingServer` (when `CI` is unset) then reuses it
instead of booting `next dev`:

```bash
# 1. Build (auto-loads .env.local → local Supabase URL baked into the client bundle)
npm run build

# 2. Standalone doesn't include static assets or /public — copy them in
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
#   (in a git worktree, server.js nests under .next/standalone/<worktree-path>/)

# 3. Inject env + start the prod server on :3000 (HOSTNAME=0.0.0.0 so localhost resolves)
set -a; . ./.env.local; set +a
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js &

# 4. Point Playwright at it (unset CI keeps reuseExistingServer=true, retries=0)
unset CI
npx playwright test --project=chromium --workers=1
```

Prereqs: local Supabase up + seeded (`supabase status`; the specs use the seed personas);
`.env.local` points at `127.0.0.1:54321`. Run the **whole** command tree as ONE process
(server `&` + specs + teardown) so the server survives; the lead runs it as a background
command (memory `subagent-cannot-run-full-e2e`, `e2e-foreground-run-recipe`).

## The batched gate runner — `npm run e2e:prod` (server restart per batch)

The single-server monolith run collapses (see TL;DR): after ~580 tests the standalone
server on Windows starts refusing connections (`net::ERR_CONNECTION_REFUSED` cascade, ~20 min
in). [`scripts/e2e-prod-gate.sh`](../../scripts/e2e-prod-gate.sh) (aliased `npm run e2e:prod`)
defeats this by splitting the suite into **batches** and starting a **fresh server — and, by
default, a fresh seeded DB — for each batch**, so no single server runs long enough to
accumulate the backlog and no cross-spec seed contamination carries over. It builds the
standalone once, then per batch pre-starts `node .next/standalone/server.js` and lets
`reuseExistingServer` (CI unset) reuse it, waiting on both Next `/login` **and** GoTrue
`/auth/v1/health` (the container restarts on reset; skipping this flakes the first logins).

```bash
npm run e2e:prod                 # full suite, batched (default 6 specs/batch, fresh DB+server each)
BATCH_SIZE=4 npm run e2e:prod    # smaller batches → more restarts (use if a batch still collapses)
RESET=0      npm run e2e:prod    # server-restart ONLY, keep the DB (faster; contamination may reappear)
REBUILD=1    npm run e2e:prod    # force a fresh `next build` — ⚠ ALWAYS pass when verifying a fix (see below)
RETRIES=0    npm run e2e:prod    # stricter: no per-test retry
SPECS="e2e/phase8-dashboard.spec.ts e2e/phi-remediation.spec.ts" npm run e2e:prod   # gate a subset
```

> ⚠ **`REBUILD=1` is NOT optional when you are verifying a fix.** This doc previously claimed the gate
> "auto-detects source drift". **It does not do so reliably** — observed 2026-07-17 (ADR 0078 Gate 2)
> printing *"reusing existing standalone build"* after real source changes, so the re-run silently
> validated **stale code** and its failure looked like a legitimate red. That burned a full debug cycle
> chasing a fix that had never actually been built. **Any `e2e:prod` run whose purpose is to confirm a
> change MUST pass `REBUILD=1`**, and check the log says *"building standalone" / "Compiled successfully"*
> before trusting the result. (Same family as ADR 0078 §7.2 — the text said one thing, the build did another.)

> **Update (2026-07-17):** found and fixed one concrete mechanism behind the false negative above.
> The `auto` drift check explicitly excluded `package.json` from the files it watches
> (`| grep -v -e 'package\.json$'`) and never watched `package-lock.json` at all — so bumping a
> dependency and reinstalling (e.g. `next` 16.2.9 → 16.3.0-preview.5) never counted as drift, and a
> batched gate run silently reused the pre-bump standalone build, executing the whole suite against
> the old `next` runtime baked into `.next/standalone`. Fixed in `scripts/e2e-prod-gate.sh`:
> `package.json`/`package-lock.json` changes now trigger a rebuild like any other watched path.
> **`REBUILD=1` remains the recommended belt-and-suspenders for a fix-verification run** — this closes
> the dependency-bump gap specifically, not every possible drift-detection edge case.

Requires bash (Git Bash on Windows; run `bash scripts/e2e-prod-gate.sh` directly if `npm run`
can't find bash) + local Supabase up/seeded. The **server restart between batches** is the
resource-buildup fix; the per-batch `db reset` (default on) is the orthogonal contamination
fix — set `RESET=0` for just the server-restart behavior. The run prints an aggregate
`GATE GREEN/RED` and exits non-zero on any hard failure. Smoke-tested 2026-07-12 (2 batches,
fresh server each → 21/21).

### Run artifacts — all written **by the script**, all under `$TMPDIR/e2e-prod-gate/`

| file | what it holds |
|---|---|
| `gate-exit` | the exit code + the verdict line. Seeded `GATE_EXIT=RUNNING` at startup, rewritten at every exit point. |
| `batch-N.log` · `batch-N-rerun.log` · `batch-N-unrun.log` | Playwright output for the batch / its INFRA re-run / a batch that never ran |
| `server-batch-N.log` · `server-batch-N-rerun.log` | the standalone server's stdout+stderr for that batch |
| `reset-batch-N.log` (+ `-retry`) | `supabase db reset` output per batch |

> ⛔ **Read `GATE_EXIT` from `$TMPDIR/e2e-prod-gate/gate-exit`, not from the launching
> wrapper.** The old convention appended `; echo "GATE_EXIT=$?"` to the launch command; the
> harness reaped that wrapper in **both** full runs of 2026-08-25, so the token never appeared
> either time and the code had to be inferred from the verdict prose. A contract that requires
> an artifact the environment reliably destroys is unsatisfiable, not strict. Measured with the
> fix in place: when only the **wrapper** is signalled the gate is orphaned and *still writes its
> own verdict*; when the **gate itself** gets SIGTERM it records `GATE_EXIT=143`; after SIGKILL
> the seeded `GATE_EXIT=RUNNING` line remains, so the file is never simply absent.

## Stack preflight (added 2026-07-28) — why the gate no longer trusts `/health`

Across six gates (CH, FF-1, FF-2, ETH·E3a, AUTHZ-1, RV2) roughly **320 of ~370 E2E failures were
infra, against 3 real regressions**. FF-2 is the cleanest data point: 762 passed / 55 failed →
**52 infra, 3 real**. The gate used to poll `/auth/v1/health` and, on failure, print
`WARN … proceeding` — so a dead stack produced batch after batch of
`net::ERR_CONNECTION_REFUSED` that a human then hand-triaged against a folklore baseline.

Two measurements changed the design:

1. **`/auth/v1/health` returns 200 while password grants 502.** The preflight now issues a **real
   `grant_type=password` request**. Port 54321 *is* Kong, so this single probe covers Kong DNS
   staleness, GoTrue death and gateway 502s at once.
2. **Our notes blamed `supabase_vector`; it is the victim, not the cause.** Measured live, vector
   had `RestartCount=0` while **`supabase_analytics` (Logflare — vector's log sink) sat at 47**,
   and analytics *still reported `healthy`*. A detector written against vector would never fire,
   and one written against `.State.Health.Status` fires never at all. `RestartCount` is the
   honest signal.

On failure the gate escalates cheap → expensive (restart `kong` → cycle the stack) and then
**aborts with exit 4**. Exit 4 is not a test result: nothing was proven, so fix the stack and
re-run rather than triaging the output.

```bash
SELFTEST=1 bash scripts/e2e-prod-gate.sh    # "is the stack fit for a gate run?" — ~1s
MAX_RECOVER=0 …                             # detect only; never touch my stack
```

### Fault-injection checklist (how each arm was proven, and how to re-prove it)

Run these after changing `preflight()`. Each must fail *and* pass in the right direction — an arm
that only ever passes is vacuous (`docs/progress/authz-handoff.md` §7.1).

| # | Inject | Expect |
|---|---|---|
| 1 | nothing (healthy stack) | `SELFTEST=1` → **exit 0 in ~1s**, no recovery attempted |
| 2 | `docker pause supabase_auth_$REF` | `MAX_RECOVER=0` → **exit 4**, stack untouched. Undo: `docker unpause` |
| 3a | double `token_ok` → true | `recover_stack` stops at the **cheap** kong restart, never cycles |
| 3b | double `token_ok` → false | escalates to the full cycle, then returns failure so the gate aborts |
| 4 | `SPECS="e2e/home.spec.ts" RESET=0 REBUILD=0` | the gate still **runs tests** and reports GREEN |
| 5 | `NETSTAT_AWK=<mutant> bash scripts/test-netstat-listener-pids.sh` | each mutant in the table below reds its own group; the unmutated parser is 17/17 |
| 6 | `bash scripts/gate-harness/retention-keystone.sh` | 28/28; scenario 1b (fix reverted) must still print **"RED as required"** ×4 |
| 7 | `bash scripts/gate-harness/false-green-keystone.sh` | 18/18. Per vector: real script **RED**, that fix reverted → **GREEN**, the *other* fix reverted → **still RED**. A vector that stays red with its own fix reverted is being closed by something else, and the differential is then meaningless |

3a/3b are unit tests against shell doubles, so they do not reset the local DB. Two real bugs were
caught this way and neither would have shown up in review:

- **Brace expansion split the JSON body.** `[ "$(curl … -d "{\"email\":…,\"password\":…}")" = 200 ]`
  — nesting escaped double quotes inside `"$( … )"` closes the outer quote early, exposing the
  braces to brace expansion. curl fired **twice**, `[` saw `400 400 = 200`, and `token_ok` was
  *always false* → every run would have aborted as "unrecoverable". Build the payload in a
  variable; never inline it.
- **`seq 1 0` emits `1 0` on macOS.** BSD `seq` counts *down* when first > last, so
  `MAX_RECOVER=0` ran recovery **twice** — the exact opposite of its meaning. Use an arithmetic
  `while` loop. (GNU `seq` emits nothing, so this is macOS-only and CI would not have caught it.)

## Batch accounting (added 2026-07-28) — a batch can no longer pass by producing nothing

The gate scraped its verdict from the batch log and piped Playwright through `tee | tail`,
so `$?` was **`tail`'s exit code** and Playwright's own verdict was discarded. A batch that
crashed before printing a summary scraped as `0 passed / 0 failed` and contributed **nothing**
to `RED_BATCHES` — a silent false green. Now each batch is RED if any of these hold:

| Condition | Catches |
|---|---|
| `failed > 0` | the ordinary case |
| `PIPESTATUS[0] != 0` with no failure line | crash / config error / collection failure |
| nothing parsed at all | truncated or empty log |
| `did not run > 0` | `describe.serial` masking (the standing recommendation below) |
| `interrupted > 0` | killed mid-run |
| accounted ≠ `--list` count | a spec silently never executed |

Every batch line now prints `accounted N/M · pw_exit R`, and the summary prints a
`COVERAGE:` line. Verified by injecting a spec that throws at collection time: previously
green, now `b1(exit1,no-summary)` → RED.

## Auth session cache (added 2026-07-28) — ~865 logins → ~300

67 of 72 spec files each defined their own `signInAs` driving the real `/login` form:
**~865 UI logins + ~54 token grants per full run, against only 28 distinct personas**
(610 of them `chefe.ccih@test.local`). That is ~40 min of pure login wall-clock and the
direct cause of the GoTrue-exhaustion failures (~50 across 10 gate runs).

All 66 now delegate to `e2e/helpers/auth.ts`, which logs each persona in once per worker
process and injects the cached cookies on later switches. The codemod replaced each local
function's **body** and kept its signature, so no call site changed. `phase2-auth-shell`
and `user-registration` deliberately keep real logins — they test the auth flow itself.

Measured A/B on an identical 4-spec prod batch: **91 → 32 logins, 77 passed / 3 failed in
both** (those 3 are pre-existing; see below).

> ⚠ **Baseline the way this A/B did.** The 3 failures were first read as a regression
> because the "baseline" ran 2 specs on a **dev server** while the failure needed the
> 4-spec **prod batch**. Unmodified code then reproduced them exactly. A baseline that
> does not match the failing configuration in *every* dimension — spec set, order, build
> type, reset state — is not a baseline. Cost: one wrong root-cause theory, acted on.

## Infra classification + test-count batching (added 2026-07-28, from the FF-5 gate)

**The problem.** The FF-5 gate printed `GATE RED — 863 passed · 53 failed`. All 53 were in
one batch, and **every one of the 106 errors in that batch was `net::ERR_CONNECTION_REFUSED`
— not one was an assertion failure.** The server had died mid-batch (`server.log`:
`The destination stream closed early`), so every test after it failed to connect. Re-running
the identical 63 tests gave 63/63.

That triage — *count connection errors per batch first, then look for any non-connection
error kind* — was correct, documented, and executed **by hand every phase**. FF-3 had the
same shape: 140 raw failures, 2 real. The runner knew about the failure mode and did not
encode it.

**What changed.**

1. **`conn_errors()` + post-run liveness → INFRA classification.** After each batch the
   runner checks whether the server process survived and how many failures carry a
   connection signature. `failed > 0 AND (server_dead OR conn_errors >= failed)` ⇒ INFRA.
   The `>=` is a floor, not a ratio: one dead server yields at least one connection error
   per failed test; a genuine assertion failure yields none.
2. **One automatic re-run** of an INFRA batch on a fresh server (`INFRA_RETRY=1`, default).
   A real failure misclassified as infra simply reproduces and is then reported as a
   failure — so the unsafe direction is self-correcting.
3. **Separate counters.** `TOTAL_FAIL` now means *defects*; infra is reported beside it.
   Conflating them is what made a dead server read as a 53-defect regression, and over time
   trains readers to discount a number that should never be discounted.
4. **New exit code 5 — RED (INFRA-only).** Zero assertion failures observed, but some tests
   never got a working server. Not a regression; **also not green** — nothing was proven
   for those tests. A batch that is still infra after its re-run is labelled
   `infra-unproven(N)`.
5. **`BATCH_TESTS` (default 70) packs batches by TEST count, not file count.** Measured on
   the real suite, file-based batching produced batches of **13 … 63** tests — a 5× spread,
   so some servers burned a full ~90 s `db reset` on 13 tests. At 70 the batch count holds
   at 15 (vs 13) while the floor rises to 46. `BATCH_TESTS=0` restores the legacy
   file-based path.

> ⚠ **Be precise about what (5) fixes.** It is tempting to say even batches prevent the
> collapse. They do not — that server died **8 tests into its own fresh lifetime**, not at
> test 63, so a smaller cap would not have saved it. (5) buys efficiency and a bounded,
> uniform blast radius, which is what makes the re-run in (2) cheap. **(1) and (2), not
> (5), are what turn a dead server into a labelled, retried, non-regression result.**

**Verification.** Classification was checked against the real FF-5 batch logs
(batch 5 → INFRA at failed=53/conn=106; batches 1, 12, 13 → clean) plus synthetic negative
controls (pure assertion failures → REAL; 2 assertions + 1 incidental connection error →
REAL). Packing was checked against the live suite (924 tests, counts matching the observed
per-spec runs). The restructured loop was exercised with stubs across four scenarios:
clean · infra-then-clean-on-retry · infra-twice · real failures.

## Four defects in the HARNESS itself (fixed 2026-08-25, PDF·P3)

All four were in `scripts/e2e-prod-gate.sh`. The first two changed nothing the gate
*measures* — one is how it kills processes, the other how it retains evidence. The last two
are **false-GREEN mechanisms**, so fixing them makes the gate *stricter*.

### The keystones — all three run without the DB, a server, or a gate run

```bash
bash scripts/test-netstat-listener-pids.sh              # ~1s   · the free_port selector
bash scripts/gate-harness/retention-keystone.sh         # ~2min · server logs + gate-exit
bash scripts/gate-harness/false-green-keystone.sh       # ~5min · vectors A and B
```

⛔ None of them touches a real port (they use `PORT=39017`, which nothing binds), a Docker
container, or a database: `RESET=0` and every external command is a shim built by
`scripts/gate-harness/build-fake-repo.sh`. The script under test is **copied and `cmp`-ed
byte-for-byte** against the repo's, so a stale copy cannot quietly pass, and
`scripts/gate-harness/lib/mutate.mjs` reverts **one fix at a time** so each is shown to be
what closes its own reproduction. Every mutator edit asserts it matched exactly once — a
mutation that silently fails to apply would report the mutant as "still red", which reads as
independence when it is really a no-op.

### 1. `free_port()` selected PIDs from the wrong `netstat` column

The selector was `netstat -ano | grep ":$PORT " | awk '{print $NF}'`, and **`grep` cannot say
which column it matched**. A client socket connected *to* the port carries it in the **Foreign
Address** column, so on a machine with live clients the selector returned **client** PIDs and
`taskkill //F` killed them. During a gate run those clients are Playwright workers — the
batch-13 signature of 2026-08-25 (`worker process exited unexpectedly` ×53). ⚠ **Mechanism
demonstrated, firing UNOBSERVED**: a teardown-phase hazard, *not* a diagnosed root cause of
that batch. It is not the same item as
`FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES`, which is about *classifying* that signature.

The parse now lives in [`scripts/lib/netstat-listener-pids.awk`](../../scripts/lib/netstat-listener-pids.awk)
and matches **only rows whose LOCAL address is that port and which are listening**.

> ⚠ **A second `grep LISTENING` would not have been a fix.** The State column is *localized*
> (pt-BR Windows prints `ESCUTANDO`), so a literal match selects **nothing** on a localized
> host — and that fails **open** in the worst direction: `free_port` stops killing the stale
> server, `start_server`'s `curl /login` probe then succeeds *against that stale server*, and
> the batch runs — possibly green — against a **stale build**. The listening state is instead
> identified **structurally**: LISTENING is the only TCP state whose Foreign endpoint is the
> wildcard (`0.0.0.0:0`, `[::]:0`, `*:*`). Columns are read positionally from ends that cannot
> move — proto `$1`, local `$2`, foreign `$3`, pid `$NF` — never `$4`/`$5`, because the State
> token is absent on UDP rows and could be multi-word in some locale.

**Keystone: `bash scripts/test-netstat-listener-pids.sh`** — ~1 s, no DB, no server, no gate
run. 17 assertions over **captured real `netstat -ano` output** (`scripts/lib/fixtures/`;
provenance in the test's header). Both directions, and the positive control is mandatory —
"the foreign-only fixture yields zero PIDs" is satisfied by a parser that returns nothing for
everything, so each negative case is paired with a listener that **must** be found.

Every assertion group was proven able to red, by pointing `NETSTAT_AWK` at a mutant copy:

| mutant | reds |
|---|---|
| listening-state check removed | the foreign-only fixture (§2) |
| local column read as `$3` | the positive controls **and** the defect (§1+§2) |
| `index()` instead of `!=` for the port | exact-port matching (§3) |
| `$4 != "LISTENING"` literal | locale independence (§4) |
| emit nothing, ever | **the positive controls (§1) — the vacuity proof** |

### 2. The gate deleted the evidence for the one failure mode it detects

The server was redirected to a **fixed** `server.log` with a **truncating** `>`, surfaced at
exactly one place: on `start_server` **failure**. So a server that started cleanly and then
died **mid-batch** — the `server_dead` condition the INFRA classifier exists to detect — left
**no retained server-side artifact at all**. Batch 7's server truncated batch 6's log seconds
after batch 6 died, in both full runs of 2026-08-25. Per-batch naming was never unavailable:
the same script already wrote `batch-N.log` and `reset-batch-N.log`.

This matters because **three causes are indistinguishable from the client side and prescribe
opposite remedies** — a V8 heap ceiling (`--max-old-space-size`), plain capacity
(`BATCH_SIZE=4`), or ⛔ **an unhandled exception in app code, which is a product DEFECT the
classifier would book as INFRA indefinitely**. Only the server log separates them. ⚠ `Error:
The destination stream closed early` is **not** a death signature — it appears in healthy
passing batches.

Now: `server-batch-N.log` per batch and per attempt, and a `tail` on the **INFRA-classification**
path as well as the start-failure path. Plus the durable `gate-exit` described above.

**Demonstrated without a 21-batch run**, by running the *real* script (byte-compared to the
repo copy) inside a throwaway tree against shell doubles — the same technique rows 3a/3b of the
fault-injection checklist already use. 27 assertions: a fake server that starts, answers
`/login`, then dies mid-batch printing a heap-limit block. Retention held across the INFRA
re-run and the next batch (each attempt's own log intact, distinct instance ids), the death
block was echoed into the run output, and `gate-exit` matched the process exit status.
⭐ The same assertions were re-run against a **pre-fix** copy and **red on four counts**
(no `server-batch-1.log`, death not surfaced, the fixed `server.log` truncated, no usable
`gate-exit`), so they are not vacuous.

> ⚠ **Two things measured rather than assumed.** (a) `bash 5.2.37` on MINGW64: a subshell does
> **not** inherit the parent's `EXIT` trap, and an untrapped SIGKILL runs no trap — hence the
> seeded `RUNNING` line rather than trap-only. (b) The **first** run of the SIGTERM check
> reported "the trap did not fire", which was **wrong**: the signal had gone to a wrapper
> subshell, not to the gate. Signalling the gate's own pid fires the trap promptly. A
> trap-based fix must be proven firing *against the process you actually mean to signal*.

### 3. FALSE GREEN — the gate attached to a foreign or stale listener (vector A)

`start_server` probed `curl /login` **before** `kill -0 "$SERVER_PID"`. If the spawned node
died at once — `EADDRINUSE`, because something else already held the port — curl succeeded
against that **foreign** listener on the first iteration and `start_server` returned 0. The
batch then ran against an engineer's `next dev`, or a previous gate's orphan serving a
**stale build**. And because the INFRA classifier only evaluates `srv_dead` when `f > 0`, a
fully-passing batch reported **`GATE GREEN` with `server_dead=1` printed zero times**.
Reproduced: `GATE GREEN`, `gate-exit=0`, server log `listen EADDRINUSE`.

The wait loop now checks **liveness first**. On top of that, two further questions are asked
— deliberately kept apart, because they are not the same question:

| question | mechanism | definitive mismatch | cannot determine |
|---|---|---|---|
| is my process alive? | `kill -0`, first in the loop | hard fail | — |
| is my process the one answering? | the listener on `$PORT` must be my WINPID (`ps -W` col 4) or a **descendant** of it | hard fail | inconclusive |
| are these the bytes I staged? | a nonce under `.next/static`, fetched at `/_next/static/__gate-nonce.txt`, carrying the `BUILD_ID` that answered | hard fail | inconclusive |

Where an arm **cannot reach a conclusion** it warns and proceeds — "this server does not serve
the nonce" and "a foreign server answered" are indistinguishable from outside, and aborting a
40-minute gate on an unverifiable arm is the worse failure. `SERVER_IDENTITY=warn` downgrades
even a definitive mismatch, should the identity arms ever misfire mid-gate.

> ⛔ **The nonce must live on a path the middleware does not gate — and the arm must be able to
> tell "no nonce" from "a different nonce".** The first version served it from `public/` as
> `__gate-nonce.txt`, which is **not** in `src/proxy.ts`'s matcher exclusions (`.txt` is absent
> from the extension list), so it hit the ADR-0007 auth gate. Measured against a real build:
> `GET /__gate-nonce.txt` → **HTTP 307**, body `/login?redirect=%2F__gate-nonce.txt`. That body
> is not a nonce, but it is not *empty* either, so the arm read it as "a different nonce" and
> **hard-failed a perfectly good server** — a 6-minute smoke run caught what 13/13 keystone
> assertions had not. Two changes, and both were needed:
>
> 1. **Reachability.** The nonce moved to `.next/static`, served at
>    `/_next/static/__gate-nonce.txt` — a matcher exclusion by **name**, and the directory the
>    gate already stages, so the nonce rides with the build output rather than beside it.
>    Measured on the same build: **HTTP 200** with the exact nonce.
>    ⛔ **Do not instead add the path to the middleware's public matcher.** The middleware is
>    the security boundary; the harness adapts to the app, never the reverse. An excluded
>    *extension* (`.map`, `.css`, …) also works — measured — but that list exists for
>    static-asset content types and is a more fragile coupling than the `_next/static` name.
>    Adding `BUILD_ID` to the already-public `/api/health` was rejected too: that endpoint is
>    unauthenticated and documented as "must never read a session or leak data", and widening
>    an app security surface for a test harness is the same inversion.
> 2. **Discrimination.** A body counts as a nonce only if it is **nonce-shaped**
>    (`^gate<pid>-b<n>-a<n>-<epoch> build=`). Anything else — a redirect, an HTML page, a
>    401/404, an empty body — is **inconclusive**. The HTTP status is captured alongside the
>    body so the inconclusive line says *why*; printing only the body is the sole reason the
>    307 was diagnosable at all.
>    ⛔ **The fix is discrimination, not a weaker verdict.** Making mismatches warn would have
>    silenced the measured case along with the unmeasurable one. The keystone pins **both**
>    directions, and explicitly asserts that a genuine mismatch was *not* blanket-downgraded.
>
> ⚠ The sibling arm was re-checked for the same conflation and had a narrower version of it: a
> listener owned by a **child** of our server read as "owned by a stranger". Next standalone is
> single-process today, so this decided nothing — but it was a hard fail resting on an
> unverified assumption, which is exactly what just misfired. It now resolves ancestry (via
> `Get-CimInstance Win32_Process`) and answers **could not determine** when it cannot, verified
> on a real parent/child pair where the listener was genuinely a child.

> ⚠ **The nonce narrows the `REBUILD=1` trap; it does not close it.** It proves the answering
> process serves the tree **this run staged**, not that the tree is fresh relative to source.
> `REBUILD=1` when verifying a fix remains mandatory.

> ⭐ **Exercised against a real build, which is the whole lesson.** With the shipped code and a
> real standalone server: the nonce under `_next/static` **verifies**; the old gated path comes
> out **inconclusive naming HTTP 307**; a real 200 carrying a nonce-shaped body from another
> tree **hard-fails**; and `SERVER_IDENTITY=warn` downgrades it. An identity arm that has only
> ever been run against shell doubles is not believed.

### 4. FALSE GREEN — a failed `--list` disabled coverage reconciliation (vector B)

`expected_tests` had **no fallback**, so a transient `--list` failure left `exp=0` — and a
zero `exp` disables the coverage machinery on *both* sides: the `count($accounted/$exp)`
check is guarded by `[ "$exp" != "0" ]`, and `TOTAL_EXPECTED += 0` shrinks the denominator to
whatever actually ran. Reproduced: a batch holding 60 tests ran 3, Playwright exited 0, and
the run printed `COVERAGE: accounted for 3 of 0` and **`GATE GREEN`**. `pack_batches` already
guards the identical hazard (`[ -z "$n" ] && n=$BATCH_TESTS`, commented *"must not silently
pack as 0"*); this path simply never got the guard.

The caller now supplies the fallback **and refuses to be quiet about it**: three lines at
collection time naming the batch and the guess, a `list-failed(exp guessed N)` reason that
reds the batch, and a summary line stating the COVERAGE denominator **contains a guess and is
not authoritative**. A guessed denominator nobody is told about is the same defect with a
nicer number.

> ⚠ A transient `--list` failure now reds its batch even if every test ran and passed. That
> is intended: an unprovable denominator means coverage for that batch is not established, and
> the gate's own rule is that unproven is not green. Re-run the named batch.

## Recommendations

1. **✅ DONE (2026-07-12) — `npm run e2e:prod`** ([`scripts/e2e-prod-gate.sh`](../../scripts/e2e-prod-gate.sh))
   wraps the recipe (build → stage → per-batch serve → `playwright test`) **and restarts the
   server per batch** to defeat the monolith collapse — see the section above. Make the
   phase-gate "declare green" step use it, not `next dev`.
2. **Run the FULL suite on the prod build periodically** — nightly, or as a required
   check before merging to `main` — not per-commit (a prod build + 20–40 min suite is too
   slow for every push). Per-commit stays on `dev` for speed; the periodic prod run is
   what catches drift *between* phase gates.
3. **Triage against the flaky baseline, don't gate on zero.** The prod gate has ~18–27
   known-flaky failures (memory `e2e-prod-build-flaky-baseline`); diff each run against a
   baseline before calling regression.
4. **De-serialize independent tests, and treat "did not run" as a failure.** In this run
   one deterministic failure (`answer-model-v2` DV-2) silently skipped **4** downstream
   tests via `test.describe.configure({ mode: 'serial' })` — they reported as "did not
   run", not failures, so a real gap hid behind a green-ish summary. The `DV-n` tests each
   build their own form (unique `Date.now()` title) and don't share state, so serial mode
   buys nothing here but the masking. Reserve serial mode for genuinely stateful chains,
   and have the gate flag any non-zero "did not run" count for investigation.
5. **Require a real `next build` in the green bar**, per the standing traps (memory
   `client-import-server-query-module-breaks-build`, `rsc-server-fn-prop-client-crash`):
   `tsc`/`vitest`/`dev` passing is not sufficient evidence a change ships.

## Worked example — the 2026-07-11 run

- 5 builder specs, 35 tests, prod standalone build (`next@16.2.9`), `--workers=1`:
  **30 passed / 1 failed / 4 did not run.**
- The 10 renamed-label assertions all pass after the fix (9 in the run + `DV-3` confirmed
  in isolation). Committed as `test(e2e): retarget form-builder condition toggle to
  renamed labels`.
- The 1 failure (`DV-2`) is **not** a stale selector — it's BUG-AMV2-002 regressed
  (choice-default publish rejected). Left untouched (the spec is correctly catching a real
  bug) and flagged for the owning engineers.

## Two collisions when an engineer works while the gate is up (FF-3, 2026-07-28)

Both cost time before being diagnosed; both look like defects and are not.

**1. `next build` fails with Windows `EBUSY` on `.next/standalone` while a prod-standalone
server is running.** The running `node .next/standalone/server.js` holds the directory, so a
concurrent build cannot replace it. This will hit **any** engineer running `next build` while a
tester's gate is up — and the gate can run 18–40 minutes.

*Do not kill the other session's server to unblock yourself.* One owner per stack: killing a
process mid-run is how a local DB was corrupted for ~30 minutes previously (memory
`shared-local-stack-single-owner`), and `TaskStop` does not reap the gate's process tree anyway.
The clean workaround, used successfully in FF-3: build to a scratch `distDir` behind an
**env-gated** `next.config.ts` branch — inert without the env var, so a concurrent build is
unaffected — then restore the config byte-for-byte and confirm it `git`-clean.

> ⚠ **The workaround is NOT side-effect-free, and FF-3 proved it twice over.** `next build`
> **auto-rewrites `tsconfig.json`** — it injected `.next-verify/types/**/*.ts` and
> `.next-verify/dev/types/**/*.ts` include entries for the overridden `distDir` and reformatted
> every array to multi-line. Restoring `next.config.ts` alone leaves that behind, pointing at a
> scratch directory that no longer exists. **Revert `tsconfig.json` too**, and check `git status`
> for anything else the build touched rather than only the file you edited.
>
> It also cost a misattribution in both directions: the engineer reported the stray `tsconfig.json`
> as belonging to the tester, and the tester read it as proof an engineer was building *right then*
> — when in fact the build had already finished. **A stray artifact is evidence that something ran,
> never evidence that it is still running.** Check for a live process (`netstat -ano | grep :3100`)
> before concluding a session is active.
>
> Separately: a `next build` that **fails** with `EBUSY` can still have deleted `.next/server` and
> `.next/standalone` first. The running server then 500s every route with
> `InvariantError: The client reference manifest for route … does not exist`. A tester should copy
> the standalone tree to a scratch directory and serve from there, so a concurrent build in `.next`
> cannot invalidate a run in progress.

**2. A query issued within ~30 s of `supabase db reset` can report a catalog that looks
destroyed** — the `app` schema and RPCs like `submit_response` appearing "missing", and pgTAP
reporting mass failures. The queries are racing the reset's *"Restarting containers…"* step. It
also makes a **successful** reset look failed, because `reset ok` never prints, so inferring from
the absent success line points the wrong way.

Gate on container health before querying, not on elapsed time:

```bash
docker inspect -f '{{.State.Health.Status}}' supabase_db_azkbbhskturikxpgmafq
```

Wait for `healthy`. If you see a catalog that looks wiped, check this **before** concluding
anything and do not re-reset reflexively. Same triage family as the `supabase_vector` crash-loop
(memory `supabase-vector-crashloop-502`): infra masquerading as regression.

## References

- Plan: [pre-pilot-foundations-program.md §7](../plans/pre-pilot-foundations-program.md)
- Memories: `e2e-gate-prod-build`, `e2e-standalone-server-not-next-start`,
  `e2e-prod-build-flaky-baseline`, `e2e-foreground-run-recipe`, `subagent-cannot-run-full-e2e`,
  `case-dialog-prod-refresh-layout-revalidate` (BUG-AIF-001),
  `choice-default-publish-regression` (BUG-AMV2-002).
