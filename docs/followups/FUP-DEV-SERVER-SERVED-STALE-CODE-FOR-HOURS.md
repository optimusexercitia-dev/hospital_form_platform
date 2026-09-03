# FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS — a green E2E run against a stale instrument is indistinguishable from a real pass (owner: tester/lead; filed 2026-08-22, found mid-verification in Increment 2)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-22 · status open

**What happened.** The long-lived `next dev` process (PID 10664, started **11:20:33** local) was serving
**pre-Increment-2 code** for files whose commits landed at **12:33, 12:45 and 14:30** — hours earlier. It
rendered the appoint dialog **without** the fifth `read_cases` checkbox and **with** the retired PHI copy
(*"inserir e visualizar dados de paciente"*), while the same files on disk plainly carried the new code.
`taskkill` + `rm -rf .next` + a fresh `npm run dev` fixed it immediately.

⭐ **It was one step from being filed as a product bug.** A "Múltiplos casos" bulk-gate failure was about
to be reported as a defect in the new two-key gate. It was the instrument. The tester's own discipline —
*clear `.next`, rebuild, re-run before reporting a regression* — is the only reason it was not.

⛔ **MECHANISM NOT ESTABLISHED, and that is the honest state.** The old process's console output was **not
captured before the kill**, so it is unknown whether the watcher had died or was alive and silently
dropping events. The staleness was **not** deliberately reproduced afterwards — manufacturing a second
stale window mid-session was judged not worth the risk, which was the right call and leaves the cause
open. ⚠ Do not let a later reader turn "restarting fixed it" into a diagnosis; it is a remedy, not a cause.

⛔ **The blast radius is every green run, which is the direction nobody investigates.** A *failing* spec
against stale code gets investigated and the staleness surfaces — that is exactly what happened here. A
**passing** spec against stale code is indistinguishable from a real pass and is never questioned. So the
suspect population is not "runs that failed"; it is **every `npx playwright test` executed against a
long-lived dev server in this repo**, and its size is not established.

**Bound, stated so this is not over-read:** `npm run e2e:prod` — the §6 step-2 gate — builds a prod
standalone bundle and never touches a dev server. **The phase gate is unaffected.** This is a
quick-loop-instrument problem, not a gate problem.

#### ⭐ MECHANISM ESTABLISHED 2026-08-22 (later the same day) — and it is OUR tooling, not another session

The entry above says the mechanism was not established, and twice that day the interference was
attributed to *"another Claude session on this shared machine"*. **That attribution was wrong, and the
real mechanism is in this repo's own config.**

`playwright.config.ts:31-36`:
```ts
webServer: { command: 'npm run dev', url: 'http://localhost:3000',
             reuseExistingServer: !process.env.CI, timeout: 120_000 }
```

So **every `npx playwright test` invocation boots `npm run dev` on port 3000** when nothing is
listening, and **reuses** whatever is listening when something is. Two consequences, both observed:

1. **A `npm run dev` server is left behind.** The tester found and killed *"one more benign leftover
   from my own successful `webServer` boot — not crashed, just idle"* — i.e. it observed this happening
   from its own run, not someone else's.
2. **That server holds ~20 live connections to the local database**, which is what makes
   `supabase db reset --local` fail part-way through the baseline. Measured: with it killed, app
   connections dropped 20 → 11 and a reset succeeded **on the first attempt** (440 registered = 440
   files) after failing **3 of 4** attempts before.

⛔ **This explains the whole day's interference without invoking another session:** backend's three
failed resets and the DB stranded at 325 of 440 migrations · a pgTAP run returning **4 failures and ~300
fewer tests** (6621 vs 6941) that was **fully green** on a clean re-run · `191_grant_hardening` §2.3
failing once and never again · and the "stale server" this entry was originally filed about — a
**reused** long-lived dev server is exactly what `reuseExistingServer: true` produces, and nothing
guarantees it is younger than the code under test.

⚠ **What is still NOT established:** whether *every* leftover observed that day came from this path.
Other sessions on the machine can also start servers, and one process seen listening cannot be traced
to its parent after the fact. The claim here is that this path **is sufficient** to produce every
symptom observed — not that no other path contributed.

⭐ **The reusable lesson is about the attribution, not the config.** "Another session did it" is
unfalsifiable, costs nothing to say, and **stops the search**. It was believed twice, by two different
agents, on evidence that fit the local explanation equally well. The config line had been sitting in the
repo the whole time.

**Additional close condition, now that the mechanism is known:** either stop the E2E entry point from
leaving a server behind, or make `supabase db reset` refuse to start while anything holds a connection
— a reset that half-applies **440 migrations** and reports a partial state is worse than one that
declines. ⚠ `e2e:prod` is unaffected (it manages its own standalone server and clears the port per
batch); this is the **quick-loop** entry point.

**To close — the cheap fix does not require the mechanism.** A **proof-of-life** at the start of any
dev-server E2E run: assert something that exists *only* in HEAD before any other assertion, so a stale
server fails loudly at the first step instead of quietly passing. That catches the whole class whatever
the cause. ⚠ It must be a check that is **read**, not an implicit `beforeAll` precondition, and it must
be built so it can fail — this repo has a recorded case of a positive control that passed while priming a
cache and made the real assertion meaningless. Establishing the actual mechanism (watcher death vs
dropped events) stays worth doing, but it is not a precondition for the guard.
