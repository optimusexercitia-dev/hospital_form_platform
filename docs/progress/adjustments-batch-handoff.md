# Handoff — Grouped Adjustments Batch (2026-07-07, paused mid-gate)

Checkpoint handoff for the **grouped adjustments batch** (Departments, Flagged +
aggregate result criteria, form-builder dialog cluster, "Others" open option,
wizard UX + masked time-field, views/labels, meeting participants,
openNarrativeCount). Plan: `C:\Users\micha\.claude\plans\a-few-adjustments-have-misty-engelbart.md`.
Live status detail lives in **PROGRESS.md** (the "Form-Builder Enhancements batch"
block); this file is the resume map.

## Status at pause: BUILD COMPLETE + batch specs GREEN, mid full-regression

- **All 10 build tasks done** (tasks #1–#10, all `completed`).
- **Batch E2E: 29/29 GREEN** on a fresh prod-standalone build —
  hospital-departments 6/6 · flagged-aggregate-result 3/3 · wizard-others-ux 7/7 ·
  views-labels-participants 8/8 · builder-dialog-ui 5/5.
- **Unit/type/build green:** tsc 0 · ESLint 0 · Vitest 306/306 · pgTAP 72 files/1787 ·
  `next build` EXIT 0 → `.next/standalone/server.js` produced.
- **All 4 gate bugs fixed + tester-verified:** FBE-005 (client value-import from
  server queries module aborted `next build`), FBE-006 (aggregate result rules
  couldn't save — validator whitelist), FBE-007 (masked time `930`→`09:30`),
  FBE-008 (Outro free text never persisted — TRUE root cause was the
  `wizard-runner.tsx` adapter omitting `otherTextByItemId`, a BUG-FBE-004
  recurrence; fixed by spread-forwarding both adapters + an adapter-layer
  regression test).

## What is committed by this handoff

Everything in the working tree **EXCEPT the concurrent session's auth-screen
edits** (`src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`,
`src/components/auth/auth-hero.tsx`, `src/components/auth/login-form.tsx` — the
"Mostrar senha" toggle work). Those 4 files are **intentionally left uncommitted**
per the locked batch decision — they belong to a different workstream. Do not
sweep them into a batch commit without confirming with that workstream.

## ⏳ IN FLIGHT at pause — full regression run v2 (background `b0b1vfku8`)

The full E2E regression suite is running as a background command.
- **v1 was INVALID**: the `output:standalone` server OOM-crashed silently ~100
  tests into a 34-min/643-test run → 400× `net::ERR_CONNECTION_REFUSED` cascaded.
  Only ~98 passed + ~4 genuine pre-existing flakies ran before the death. **Not a
  batch regression** — infra fragility.
- **v2 hardening** (`scratchpad/full-regression-v2.sh`): server under an
  auto-restart supervisor + 4 GB heap so a crash costs only the in-flight test,
  plus Playwright `--retries=1` to absorb restart-window flakies; fresh db reset,
  reuse the v1 build.
- **Logs** (scratchpad, NOT in repo):
  `.../scratchpad/pw-results-v2.log` (per-test), `supervisor-v2.log` (restart
  count), `server-v2.log`, `full-regression-v2.out.log` (run head).
- **On resume — triage:** compare genuine (non-`ERR_CONNECTION_REFUSED`) failures
  against the **~18–27 flaky baseline** (memory `e2e-prod-build-flaky-baseline`).
  Real batch regression = a failure NOT in that baseline. If the server still died
  (many connection-refused), re-run — do not read it as regression.

## ▶ ON RESUME — remaining gate steps (Phase Gate §6)

1. **Read the v2 result** (`scratchpad/pw-results-v2.log` tail + SUMMARY in the
   task output). Triage vs flaky baseline. If green-modulo-baseline → proceed; else
   dispatch fixes (engineers still warm).
2. **QA review** — spawn `qa`; audit batch vs CLAUDE.md, RLS on
   `hospital_departments`, the aggregate-key validator, the answer-model `other_text`
   path. Flag to QA: the wizard `getLatestSnapshot` ref (iter-3 of FBE-008) as a
   **candidate simplification** now that the true cause was the adapter — QA to weigh
   keep-vs-simplify on the merits. → `docs/reviews/`.
3. **Human approval.**
4. **Record** (§6.5): PROGRESS phase/status, rotate batch detail to
   `docs/progress/`, update `docs/backend-state.md` (new: `hospital_departments`
   table + RLS, `cases.department_id/department_other`, aggregate result keys
   `__total_score__`/`__flagged_count__`, `answers.other_text`, `form_item_options.flagged`,
   `seed_selected_meeting_attendees` RPC).
5. **Remote `db push`** — the 6 new migrations `20260713000500…001000` are LOCAL
   only. `supabase db push` needs **direct user authorization** (auto-denied for
   background agents — memory `remote-db-push-needs-user-auth`). Regenerate types
   after.

## Warm agents (resume by agentId via SendMessage)

- backend `a1ae8d78679011f45`
- frontend `a158aa77b70680556`
- tester `a4d77f72678da309d`

## Environment gotchas (memory-backed)

- **App reads LOCAL Supabase** (`postgres@127.0.0.1:54322`); migrations run locally
  via reset/`migration up`, remote via `db push` (user-authorized).
- **Standalone server dies on long full-suite runs** → supervise + retries (v2).
- **`supabase db reset` can wedge Kong→GoTrue** (`/auth/v1/*` → 502, `/rest/v1/`
  200); recover with `docker restart supabase_kong_azkbbhskturikxpgmafq` (GoTrue
  restart alone does NOT fix it).
- E2E gate = prod-standalone (`node .next/standalone/server.js` after copying
  `.next/static` + `public`), NOT `next start`, NOT `next dev`.
- **New green-bar rule for this batch:** a successful `next build` (standalone
  output) is REQUIRED — tsc/lint/vitest miss client/server bundling violations.
