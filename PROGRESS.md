# PROGRESS.md — Live Project State

> **This file holds LIVE STATE ONLY — it is loaded by every spawn.** Current
> phase/next actions, non-complete phase rows, OPEN bugs, the measured State block,
> Critical FUP, and the OPEN follow-up index. **An entry leaves the moment its work
> merges to `main` and is recorded** — completed phase rows move (verbatim) to
> [phase-ledger.md](docs/progress/phase-ledger.md), resolved follow-up index lines to
> [follow-ups-archive.md](docs/progress/follow-ups-archive.md), closed bugs to
> [bug-log-archive.md](docs/progress/bug-log-archive.md), concluded gate/QA/decision
> rows to their archives. History is **never** re-derived here; it lives in the
> archives, the ADRs, and git.
>
> **The contract is machine-enforced**: `npm run lint:progress`
> (`scripts/check-progress-doc.mjs`, gate 7 of `npm run lint`) fails on: this file
> over **60 KB** · a `✅ complete` row in § Phase Status · a resolved line in the
> § Follow-ups index · a relative link that does not resolve · an OPEN follow-up
> index line with no body in [follow-ups.md](docs/progress/follow-ups.md) · a missing
> required section · CRLF. Update state here first — never report status verbally
> without writing it here (CLAUDE.md §7). Each teammate edits only their own rows;
> the lead owns § Now and § Phase Status.
>
> Restructured 2026-08-18 from the historical tracker (75 KB → live-state-only).
> The prior banner narrative was not copied anywhere — it is history, and it lives
> where history lives: git (`a03b4800` and earlier).

## Now — current phase & next actions

_Lead-owned. This section replaces the old "Current Phase Tasks" + "🛑 START HERE"
banners; the full DM-FUP triage narrative those banners carried is preserved verbatim
in [dm-fup-triage-2026-08-18.md](docs/progress/dm-fup-triage-2026-08-18.md)._

- **No phase is active.** The **DM program (DM0–DM5) is COMPLETE** — closed
  2026-08-18, all five gate steps; phase QA APPROVED r2
  ([review](docs/reviews/dm5-phase-review.md)). The DM follow-up triage of
  2026-08-18 ruled eleven items and shipped five (gate-green: pgTAP 194f/6397 ·
  lint · tsc · vitest 1305 · 4 authz ARMs HOLD; ⛔ `e2e:prod` was NOT part of that
  batch — the standing green is the 2026-08-17 DM5 gate run, 1121p/0f).
- **✅ DONE 2026-08-18 — the Cloud constructed-orphan probe RAN and settled.** Every
  measured Cloud surface is **METADATA-BOUND**; Cloud exposes **no orphan-visible
  surface**, so the byte half is structurally unverifiable there and the runbook's
  *asserted, not verified* posture is evidenced. `FUP-DM4-PRODROW` is **unblocked** —
  and its "~49 vanished" figure is **withdrawn** (§ State). Record:
  [cloud-orphan-probe-2026-08-18.md](docs/progress/cloud-orphan-probe-2026-08-18.md);
  instrument `scripts/cloud-orphan-probe.mjs`.
- **▶ Next, in order** (PO-sequenced 2026-08-18):
  1. **C1a** — local end-to-end run of
     [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md).
  2. **C2 Tier 1 sizing** (absorbs `Q1-OPEN-BYTES-CUT` + `SIBLING-GUARD-DIFF`).
  3. **`FUP-DM4-PRODROW`** — now actionable: re-derive a magnitude, or rule that it
     cannot be (TRIAGE #9 already forbids closing it as "reconciled").
- **⚠ Held, not blocked** (TRIAGE #11): local-only migrations `20260928000600` +
  `20260928000700` are **HELD** from `db push` — the census lifted the safety bar,
  but *a bar lifting is not a reason to act*.
- **⚠ Three facts a session must not trip over** (full context in the
  [triage narrative](docs/progress/dm-fup-triage-2026-08-18.md)):
  1. The remote DB is **EMPTY** (reset 2026-08-17 11:37Z) — see § State; the safety
     of every remote action rests on that fact, and it **expires when the pilot
     loads data**.
  2. `DANGLING-PRINT` is **CLOSED** (ADR
     [0123](docs/decisions/0123-discarding-a-draft-that-has-emitted-documents.md));
     a third defect found during closure is OPEN as
     `FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION`.
  3. **C1 split into C1a (local) + C1b (Cloud); the pilot bound is C1b** — a green
     local rehearsal does NOT release the pilot (§ Critical FUP C1).
- **In-flight worktrees:** `progress-methodology` (this restructure — tracker
  methodology + CLAUDE.md review cadence).

## Phase Status — live rows only

> **Completed rows live in [phase-ledger.md](docs/progress/phase-ledger.md)** —
> append-only, every phase forever, moved there 2026-08-18. Only rows **not yet
> `✅ complete`** stay here; at the §6 Record step the completing phase's row moves
> to the ledger **verbatim** (the gate fails on a `✅ complete` row here). Verbose
> cell prose for old rows: [phase-status-archive.md](docs/progress/phase-status-archive.md).

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 9 | Deployment | 🔜 not started | – | – | – | – | – | – |
| 18 | Self-Assessment & Internal Audit | 🔜 not started | – | – | – | – | – | – |
| 19 | Surveyor Access & Evidence Export | 🔜 not started | – | – | – | – | – | – |
| 22-v3 | **REG·KIND — one Registro vocabulary** [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) (supersedes [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) **D2** only) | ⚠ **merged, gates 2–4 UNRUN** | ✅ Vitest 1254 | ⚠ **step 1 only** — pgTAP **183f/5857** · 3 ARMs HOLD · E2E targeted 24/24, **no `e2e:prod`** | ⛔ **not run** (PO direction) | ⛔ not sought | 2026-08-12 | remote catalog |
| DLB | **Deliberation & Voting Model** [0115](docs/decisions/0115-deliberation-and-voting-model.md) ([plan](docs/plans/deliberations.md)) | ADR PROPOSED — NOT ratified; nothing built and nothing may start | – | – | – | ⛔ **not ratified** | – | taken |

## Bug Log

<!-- OPEN bugs only. Resolved/closed rows rotate to docs/progress/bug-log-archive.md (or the
     owning phase's record) at each §6 Record step. -->

### 🔴 OPEN — the live bugs

⚠ **Heading added 2026-08-14** (and re-titled 2026-08-17 when a fourth bug landed — *the count was in
the heading, which is a figure that goes stale the moment it is right*). These sat between two
"Closed" headings with no heading of their
own, so an open production blocker (BUG-BOOTSTRAP-001) read as filed under *Closed*. Open bugs use bold
markers rather than headings, which is exactly why a rotation bounded by heading syntax would have
archived them — **derive the boundary by the PROPERTY (is this CLOSED?), never by markup.**
⭕ **Rotated out of here on 2026-08-18 — each one closed well before its row said so.** A LIST, not a
count: append to it, and nothing already written goes stale.

- **BUG-DM5-S6-EVID-KBD-1** — fixed 2026-08-17, never marked.
- **BUG-DM5-S3-INACTIVE-PRINT-1** — fixed by DM5·S3, in the slice that filed it, never marked.
- **BUG-DM5-S3-ENV-FIXTURE-POOL-1** — met its own "re-verify on the next fresh-reset run" criterion
  on 2026-08-17, never marked.

⛔ **No live bug count appears in this section, deliberately.** Two attempts already went stale inside
a single day — first the heading, then a note saying "back to three" — in the one paragraph of this
file whose whole subject is that a count is wrong the moment after it is right. Count the rows below.

🔴 **BUG-BOOTSTRAP-001 — there is no in-app path to create the FIRST `platform_admin`; production
onboarding has an undocumented manual SQL step.** Filed 2026-08-06 (lead) when the AFF completion
narrative was rotated — **this was the one open item in it that existed in no other tracked place**,
which is why it is here rather than in Follow-ups. Surfaced during AFF, **not caused by it**.
**Mechanism:** `is_admin` is set only by direct SQL, and the promote guard requires an **existing**
admin to promote another — so the set is closed under the product. On a fresh production database it
starts empty and nothing in the app can open it. **Impact:** the first production `platform_admin` is
a manual `update profiles set is_admin = true …` that **appears in no runbook** — not in
`docs/deployment/`, and not in any pre-pilot checklist. Whoever runs the pilot deploy hits this
with no written instruction.
⚠ **Not a security defect — the closure is deliberate** (it is what stops self-promotion, and the
guard is correct). The defect is that the bootstrap is undocumented and unautomated, so do **not**
"fix" it by weakening the guard.
**Status:** OPEN, unassigned. Two candidate dispositions, PO's call: (a) document it as an explicit
step in the pilot-deploy runbook — cheapest, and sufficient for one pilot tenant; (b) a
seed/CLI-driven bootstrap that mints the first admin idempotently. **Blocks nothing today** (local +
E2E get `platform@test.local` from `seed.sql`, which is exactly why the gap is invisible to every
gate), but it is on the critical path of the **first production deploy**.

### Closed → [bug-log-archive.md](docs/progress/bug-log-archive.md)

**Rotated 2026-08-18 (3)** — **BUG-DM5-S3-ENV-FIXTURE-POOL-1** · **BUG-DM5-S3-INACTIVE-PRINT-1** ·
**BUG-DM5-S6-EVID-KBD-1** — all three *closed well before their rows said so*; full repro, mechanism
and closure evidence → [archive § "Rotated 2026-08-18"](docs/progress/bug-log-archive.md). Verbose
narratives rotated 2026-08-18 → [archive § "Bug Log closure narratives"](docs/progress/bug-log-archive.md).

**Rotated 2026-08-14 (5 + earlier)** — BUG-DM5-S2-STUB-1 · -WRITE-ARM-1 · -CITATION-TARGETS-1 ·
BUG-DM5-CAPA-1 · BUG-DM4-DUP-1, plus BUG-DM2-001/-002/-003 and BUG-CASEKIND-001 → same archive.

⛔ **Three warnings from those closures that must NOT be lost with the narrative:**
- **Do NOT add `is_active` to `app.can_view_printed_document`.** The print door admits a deactivated
  account **by decision**, pgTAP `342` S3c3 pins it, and a second copy of the same predicate is the
  *two-locks-that-are-one-lock* trap. The authority is the **conjunction**.
- **Date a log before citing it.** The gate's directory holds a `batch-9-unrun.log` ("BATCH 9 DID NOT
  RUN") naming the very spec used as pass evidence; reading it as the passing run inverts the verdict.
- ⚠ *A fix commit is not a status edit* — BUG-DM4-DUP-1 and BUG-DM5-S6-EVID-KBD-1 each sat marked
  OPEN for days after their fix shipped.

**Earlier eras** (rotated 2026-08-06 → 2026-08-12) — each bug's full entry, repro and lessons are in
the archive. The navigation hooks worth keeping live:

- ⚠ Before touching `buildAnswerMaps`, read **BUG-FF4-001** — the obvious one-line fix breaks Rule 3
  SQL↔TS evaluator parity.
- ⚠ Before diagnosing any minutes E2E failure, read **BUG-MIN-E2E-1** — closed as **NOT a product
  defect** (a stale per-worktree `.env.local` `MINUTES_SERVICE_URL`, `:8000` vs the stub's
  `127.0.0.1:8891`). The durable fix is the mutation-proven `beforeAll` precondition guard, not the value.
- ⚠ Before touching Radix dialog focus, read **BUG-RDR-001** + **BUG-ETHE4-FOCUS-1** — `onCloseAutoFocus`'s
  `preventDefault()` **also cancels `FocusScope`'s own restore**, so both halves must be replaced
  together; and a bubble-phase `stopPropagation()` cannot beat `DismissableLayer`'s capture-phase
  Escape. Untested residual: **FUP-ETH-KBD-1**.
- ⚠ **BUG-ACT-ACL-1 closed one instance, not the population** — that population is now swept by
  AUDIT-INVOKER-WRAPPER, with `FROMFINDINGS=1 ARM=wrapper` standing as a §6 step-1 gate over it.
- **FUP-VACUOUS-COVERAGE-1 stays OPEN**: `phi-remediation` REM-8/REM-9 are honest `test.skip()`s,
  outside the vacuity property, so `lint:vacuous` will never catch them.

## Test Run Summary

<!-- Most recent gate only, ONE ROW each. The narrative — triage, dispositions, mutation proofs —
     rotates to docs/progress/test-run-archive.md at each §6 Record (full history, Phases 0 →
     ACT, already there). -->
> **Retention: the most recent gate only.** Prior gate rows and their triage narratives →
> [test-run-archive.md](docs/progress/test-run-archive.md) (each rotation recorded there).

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-18 | **DM follow-up triage · LEAD** — the four shipped items (#2 byte proof · #4 DVF 1:1 · #8b draft-print delete guard · attachments deletion). Two fresh `supabase db reset --local` cycles; both new pgTAP arms authored **red-first** | **pgTAP 194 files / 6397 PASS** (6392 baseline **+2** `328` K17a/b **+3** `312` t74/75/76 — the parts sum) · **lint 5/5** · **typecheck 0** · **vitest 1305/1305** (+1) · authz **`census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper` all INVARIANT HOLDS**. ⛔ **`e2e:prod` NOT RUN — this row is not a phase gate.** ⚠ One RED en route was a real defect in this batch's own migration, caught by pgTAP `320` U1 at **237→238** (PUBLIC-executable `SECURITY DEFINER`), **not** by review — `312` was fully green with the door open |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| DM5 — PHASE QA | APPROVED (r2) | 2026-08-17 | [dm5-phase-review](docs/reviews/dm5-phase-review.md) |
| DM5 · S6 — canon rewrite + program exit sweep | APPROVED (r2) | 2026-08-17 | [dm5-s6-review](docs/reviews/dm5-s6-review.md) |
| DM5 · S5 — operational closure | APPROVED (r2) | 2026-08-17 | [r2](docs/reviews/dm5-s5-review-r2.md) · [r1](docs/reviews/dm5-s5-review.md) |
| DM5 · S4 — legacy storage-bucket retirement | APPROVED (r3) | 2026-08-17 | [r3](docs/reviews/dm5-s4-review-r3.md) · [r2](docs/reviews/dm5-s4-review-r2.md) · [r1](docs/reviews/dm5-s4-review.md) |
| DM5 · S3 — printed renditions onto the core substrate | APPROVED (r2) | 2026-08-14 | [dm5-s3-review](docs/reviews/dm5-s3-review.md) |
| DM4 — Wave C: referrals | APPROVED (r2) | 2026-08-14 | [dm4-referrals](docs/reviews/dm4-referrals-review.md) |
| DM3 — Wave B: controlled documents | APPROVED (r2) | 2026-08-13 | [dm3-controlled-documents](docs/reviews/dm3-controlled-documents-review.md) |
| _Verbose form of the 5 rows above, incl. both struck r1 rounds_ — rotated 2026-08-14 (§5: never restate rationale here) | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| 105 concluded rows | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-18 | **PROGRESS.md becomes LIVE-STATE-ONLY, machine-enforced (`lint:progress`, gate 7); completed rows → phase-ledger.md; CLAUDE.md review cadence via Stop hook + `/review-claude-md`** (PO) | ADR [0124](docs/decisions/0124-progress-live-state-contract.md) |
| 2026-08-18 | **DM-FUP TRIAGE #1 — the Cloud orphan measurement must CONSTRUCT an orphan, not probe for one** (PO) | FUP-DM5-CLOUD-ORPHAN-SURFACE |
| 2026-08-18 | ✅ **MEASURED — Cloud exposes NO orphan-visible surface; all 5 surfaces METADATA-BOUND, both S3 auth modes.** The Cloud byte half is structurally unverifiable, so the runbook's *asserted, not verified* posture is evidenced. ⛔ Not reassurance: orphan bytes are **unobservable**, not absent | FUP-DM5-CLOUD-ORPHAN-SURFACE ⬛ · [run record](docs/progress/cloud-orphan-probe-2026-08-18.md) |
| 2026-08-18 | ✅ **TRUNCATE residue SWEPT (63 first-party tables) and the platform half ACCEPTED IN WRITING** — `20260928000900` + pgTAP `191` §5. ⭐ TRUNCATE fires no DELETE trigger, so it bypasses `storage.protect_delete` as well as RLS; and on Cloud a REVOKE we are not entitled to make returns **no error and changes nothing** (`t`→`t`), so the migration verifies the EFFECT, not the absence of an error | FUP-PCITV-1 item 3 ⬛ · FUP-DM5-STORAGE-ORPHANS |
| 2026-08-18 | ⛔ **WITHDRAW the "~49 objects vanished with no `DELETE`" figure — the arithmetic compares tuples to objects.** A residual of **60** was manufactured against a true live count of **0** while destroying nothing unaccounted for | FUP-DM4-PRODROW · § State |
| 2026-08-18 | **DM-FUP TRIAGE #2 — `reclassifyDocument` writes `unavailable_on_platform`** (PO) | FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED |
| 2026-08-18 | **DM-FUP TRIAGE #3 — Critical FUP C1 SPLITS into C1a (local) + C1b (Cloud); C1 does NOT close on C1a** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 3** (amended) · **Critical FUP C1** |
| 2026-08-18 | **DM-FUP TRIAGE #4 — `document_version_files` gets `UNIQUE (file_object_id)`** (PO) | FUP-DM5-DVF-FILEOBJ |
| 2026-08-18 | **DM-FUP TRIAGE #5 — the Q1 arm's NAMED successor is `app.resolve_document_version_bytes`, and the arm moves into C2 Tier 1** (PO) | FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN · **Critical FUP C2** |
| 2026-08-18 | **DM-FUP TRIAGE #6 — PRODROW is SEQUENCED, and the remote is NOT reset first** (PO) | FUP-DM4-PRODROW · FUP-DM5-STACK-CYCLE-DESTROYS-BYTES |
| 2026-08-18 | **DM-FUP TRIAGE #9 — PRODROW STAYS OPEN, blocked on the C1b constructed-orphan probe** (PO; both closure options declined) | FUP-DM4-PRODROW |
| 2026-08-18 | **DM-FUP TRIAGE #10 — CLAUDE.md §8 updated FIVE → SIX lint gates** (PO-approved; CLAUDE.md edits require it) | FUP-DM5-SETLOCAL-MIGRATION |
| 2026-08-18 | **DM-FUP TRIAGE #11 — HOLD the `db push` of `20260928000600`/`…000700`** (PO) | FUP-DM5-DVF-FILEOBJ |
| 2026-08-18 | **DM-FUP TRIAGE #7 — BUILD the `set local` lint gate, bounded by the FROZEN WATERMARK, not by an allowlist** (PO instrument; the lead had proposed an allowlist and was wrong) | FUP-DM5-SETLOCAL-MIGRATION |
| 2026-08-18 | ✅ **DM-FUP TRIAGE #8b — RE-RULED AND BUILT: refuse to DELETE a response that has an ACTIVE printed document** (PO), replacing the withdrawn #8. Migration `20260 | ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) D7 (preserved) · `20260928000700` |
| 2026-08-18 | ⚠ **THE #8b MIGRATION SHIPPED A PUBLIC-EXECUTABLE `SECURITY DEFINER` FUNCTION, AND A GATE CAUGHT IT — not review, and not foresight.** Created without an explicit ACL,… | FUP-ACL-APP-POPULATION · pgTAP `320` U1 |
| 2026-08-18 | ⛔ **DM-FUP TRIAGE #8 IS WITHDRAWN THE SAME DAY — it reverses a ratified decision, and NOTHING WAS BUILT.** | ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) D7 · FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT |
| 2026-08-18 | ~~**DM-FUP TRIAGE #8 — refuse a print mint from a non-`submitted` response**~~ ⛔ **WITHDRAWN — see the row above.** (PO). The narrowest of the three filed options, and the standing principle applies:… | FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT |
| 2026-08-18 | **DM5 GATE STEP 4 — ALL SEVEN DOCKET ITEMS RULED** (PO) | [phase review](docs/reviews/dm5-phase-review.md) §§5–6 · § Critical FUP |
| 2026-08-18 | ✅ **`db push` EXECUTED — all five local-only migrations applied to the remote** (PO-authorized at the docket, to carry out decision #1) | § "State" (a TOP-LEVEL section since 2026-08-18) |
| 2026-08-18 | **#4 SUPERSEDE COLLISION RULED as (b) — supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 2** · ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D11 |
| 2026-08-18 | 🔒 **#7 PILOT RISK ACCEPTED, BOUNDED BY ONE REHEARSAL** (PO) — the pilot may proceed over the manual-only PHI-disposal path **on the condition that `phi-disposal-runbook.md` runs end-to-end against… | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 3** · **Critical FUP C1** |
| 2026-08-18 | **#2 ADR 0114 O1 + O2 RULED** (PO) | ADR [0114](docs/decisions/0114-document-model-redesign.md) Open items |
| 2026-08-18 | **#1 ADR 0120 D9 — the under-count class is RATIFIED AS ACCEPTED-UNVERIFIED on Cloud; no verification step is added** (PO) | ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) **D9** · [runbook](docs/deployment/phi-disposal-runbook.md) §6 |
| 2026-08-18 | **#5 THE 407-DOOR TRIAGE IS SIZED — TWO TIERS** (PO) | **Critical FUP C2** · FUP-AUTHZ-COMMAND-DOOR-UNSWEPT |
| 2026-08-18 | **#3 UPLOADER VISIBILITY IS NOT ADDED — S1-O3 CLOSED** (PO) | ADR [0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md) § S1-O3 · [0116](docs/decisions/0116-dm1-substrate-cutover-decisions.md) §11 |
| 2026-08-18 | **#6 THE S2/S3/S5 `backend-state.md` SECTIONS ARE STILL WANTED — `backend` writes all three as ONE task before DM5 closes** (PO) | FUP-DM5-BACKEND-STATE-SLICE-SECTIONS |
| 2026-08-17 | **DM5·S5 step 4 — the follow-up batch's PO approval CLOSES S5 TOO** (PO) | PROGRESS.md § Current Phase Tasks |
| 2026-08-17 | **FUP-DM5-SUPERSEDE-SERVING-COLLISION — DECIDE LATER; the D11 inflow STAYS REVERTED** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) Amdt 1 |
| 2026-08-17 | **FUP-DM4-RECUSAL — the Phase-19 deferral is OVERTURNED; close it now with a NARROWING arm** (PO) | ADR [0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md) |
| 2026-08-17 | **ADR 0121 ACCEPTED — D2 (cron outflow) + D4 (what `disposed` asserts) ratified as proposed** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) |
| 2026-08-17 | **The PHI-disposal runbook's five open values SET** (PO) | `docs/deployment/phi-disposal-runbook.md` §6b |
| 2026-08-17 | **The local Storage volume is NON-DURABLE DISPOSABLE TEST RESIDUE** (PO) | FUP-DM5-STORAGE-ORPHANS |
| 2026-08-17 | **Finish the PROGRESS.md rotation before opening DM5·S6** (PO) | PROGRESS.md § Current Phase Tasks |

> ↩ **23 rows dated 2026-08-05 and older rotated 2026-08-17** → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-17", preserved verbatim before the cut (`cmp`-verified). This table is the **head** of the log, not the log.
| _pre-2026-07_ | **35 earlier decision rows (Phases 0–14, 2026-06-11 → 2026-06-25) rotated 2026-08-04** | [decisions-log.md](docs/progress/decisions-log.md) |

> ↩ **12 rows dated 2026-08-08 → 2026-08-14, and the VERBOSE form of the 32 rows above, rotated 2026-08-18** → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-18". ⛔ *The live rows are deliberately one-line — every warning they carried has a body in [follow-ups.md](docs/progress/follow-ups.md); verified before compressing.*

## State — the three live remote facts (measure, never quote)

_Concluded measurements → [backend-state.md](docs/backend-state.md) § REMOTE CENSUS
2026-08-18 (every figure with its deriving query); standing rules — the re-measure
recipes, the editable window, "a git push is not a `db push`", the flags posture —
→ backend-state.md § "Remote discipline — standing rules". The block's full narrative
and its three-times-stale correction history →
[dm-fup-triage-2026-08-18.md](docs/progress/dm-fup-triage-2026-08-18.md). Only facts
still awaiting a concluding event stay here:_

| live fact | concludes when |
| --- | --- |
| ⚠ **2 local-only migrations** — `20260928000800` (dangling-print supersede/mint-lock) · `20260928000900` (TRUNCATE-residue revoke). ⛔⛔ **RE-MEASURED 2026-08-18: `…000600`/`…000700` are NOT held — they are ON THE REMOTE.** Remote head is **`20260928000700`** / **413** applied, not `…000500`/411; the HOLD line was stale (3rd time this claim has gone stale). ⇒ the remote still carries the **63-table TRUNCATE residue** until `…000900` is pushed | a PO push decision for `…000800`/`…000900` (re-measure `schema_migrations`, never re-read this row) |
| ⚠ **Remote storage byte-loss is UNQUANTIFIED — the "~49 vanished" figure is WITHDRAWN 2026-08-18.** `n_tup_ins − n_tup_del` compares two units: 5 uploads move `ins` by **+6**, 5 deletes move `del` by **+5** (measured). And by the probe below, any surviving bytes are **unobservable** anyway | a magnitude re-derived from something other than the `pg_stat` counters — or PO ruling that it cannot be ([FUP-DM4-PRODROW](docs/progress/follow-ups.md)) |
| ⭐ **The remote is safe to touch today ONLY because it holds no data and no users** (census 2026-08-18) — a stronger reason than any flag argument | **expires at pilot data-load**, when it must be REPLACED by the rehearsed C1b disposal bound (§ Critical FUP C1), never just deleted |


## ⭐⭐ Critical FUP — the must-not-be-forgotten list

_**PO-curated. Entries land here ONLY on the PO's explicit instruction.** No implementer, reviewer or
lead may promote an item into this section, and nothing arrives here as a side effect of a review
round. It is the short list of follow-ups whose loss would be materially costly, kept **separate from
the general register precisely so that register's length cannot bury them**._

⛔ **NEVER ROTATE THIS SECTION — at any file size.** The general § Follow-ups index is
rotation-eligible under the §7 size discipline; this one is not. ⚠ An entry leaves only when the work
has **landed**, which is not the same as the phase it was filed in closing — *a deliverable assigned
to a slice disappears when that slice closes cleanly* (ADR 0120's own O1/O2 correction, and the reason
this section exists). Full bodies stay in
[follow-ups.md](docs/progress/follow-ups.md); these lines are the standing index.

| # | item | what must happen | trigger — the point it can no longer wait | owner |
|---|---|---|---|---|
| **C1** | 🔒 **`FUP-DM5-DISPOSAL-JOB`** — the PHI-disposal path is **manual and UNREHEARSED**. `disposal_state` records an **intent, not a destruction guarantee**: **4 SET-form writers** put rows into `disposal_pending` — 3 `authenticated`-reachable (`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`) **plus `complete_document_reclassification`, service-role-only** — against **exactly ONE** outflow door, and **nothing automated calls it** (no `pg_cron`, no cron schema, single-process Dockerfile). ⚠ *Corrected 2026-08-18: this said "three inflow doors", which is right only bounded to JWT-reachable doors — **the queue is fed wider than the item said**.* | ⭕ **SPLIT IN TWO 2026-08-18 (DM-FUP TRIAGE #3) — and C1 does NOT close on C1a.** **C1a (local)** — execute [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md) end-to-end against local test data, once, and record the run; it debugs the procedure and produces the first **destination path** for `FUP-DM5-BACKUP-IS-PHI-EXPORT`, owed at first execution. **C1b (Cloud)** — the same run against the linked project. ⛔ **Why the split is not bookkeeping:** the runbook itself says a local rehearsal *"runs against a local stack by construction, so it cannot exercise the Cloud paths"* (§6) — so a local-only run discharges this row's **wording** while leaving its **purpose** undischarged, which is [[a-predicate-quoted-at-the-wrong-grain]] in the highest-severity item in the register. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** PO-accepted 2026-08-18 as a pilot risk **bounded by this rehearsal** (ADR 0121 **Amdt 3**) — the acceptance is not open-ended, and the pilot may not admit real PHI ahead of it. ⭐ **The bound is C1b, not C1a**: the pilot runs on Cloud, so a green local rehearsal does **not** release it. | PO (executor = whoever holds service-role reach — an ACL fact, not a choice) |
| **C2** | 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — **407** reachable command doors sit outside **every** authz arm's domain (`ARM=census` is bounded to `bool`/set-returning; these return `jsonb`/`void`). ⚠ **Covered-but-UNPINNED, not blind** — a 3-door neutralization sample found all three COVERED. ⛔ **The sample may NOT be used to close it.** | **Tier 1 — sweep the subset that touches PHI or crosses a tenant boundary**, derived as a property over the catalog, never hand-listed ([[enumeration-boundary-is-a-syntax-not-a-property]]). **Tier 2 — the remainder is DEFERRED.** Each swept door gets a recorded verdict, so a regression reds and a **new** door cannot pass by absence. ⭕ **Tier 1 ABSORBED TWO ITEMS 2026-08-18** — `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` (successor named: `app.resolve_document_version_bytes`) and `FUP-DM5-SIBLING-GUARD-DIFF`. All three want the same door-mutation machinery over `prosecdef` gates; building it three times was declined. ⚠ **Absorption is not closure** — each keeps its own index line and its own verdict. | **Tier 1: next, as its own scoped workstream** — sizing is step one and is not yet done. **Tier 2: after the pilot ships, once there are real customers.** | lead + backend |

## Follow-ups / Deferred Items

<!-- ONE-LINE INDEX ONLY (severity · id · claim · owner). Full bodies of OPEN items live in
     docs/progress/follow-ups.md; resolved items in follow-ups-archive.md. Compressed
     2026-08-18 at the size rotation — every entry was verified to HAVE a body first. -->
_Full bodies of OPEN items rotated 2026-08-08 → **[follow-ups.md](docs/progress/follow-ups.md)** — update BOTH (the body there, the line here) when an item changes state. Resolved items → [follow-ups-archive.md](docs/progress/follow-ups-archive.md). One line per item: severity · id · title · owner._

⭐ **Two items also carry a [§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list) entry** — `FUP-DM5-DISPOSAL-JOB` (C1) and `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2). Their lines below stay put; the Critical entry adds a **trigger and a deadline**, it does not replace the index line.

⚠ **Six lines below are NEW index entries, not new items** (2026-08-14): FUP-AUTHZ-HARNESS-TRANSACTIONAL ·
FUP-AUTHZ-ALLOWLIST-ROT · FUP-DM5-GRANTS · FUP-DM5-FINALIZE-ATOMIC · FUP-DM5-DVF-FILEOBJ ·
FUP-VACUOUS-COVERAGE-1 — each was OPEN but named **only** inside the DM5 phase section or a Bug Log
pointer, so compressing those would have dropped it from the index entirely.

⚠ **Two MORE lines added 2026-08-17 (phase QA R3), and the 2026-08-14 warning above was written and
then immediately re-earned — this time by the highest-severity item in the phase.** Both were
announced as new by the follow-up batch, given full bodies in `follow-ups.md`, and named repeatedly in
the phase narrative — **but neither ever got an index line**, so the next rotation would have dropped
them. ⭐ *A body plus a narrative mention is not an index entry; the index is what a reader greps.*

- 🟠 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ✅ **PO-RULED 2026-08-18 as option (b): supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** — backend
- 🟠 **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — ⭐ **⭐ CRITICAL FUP C2. `ARM=census`'s DEFINER clause is bounded to `bool`/set-returning, so 407 reachable non-trigger command doors (326 RPC-callable) sit outside every arm's domain. ⭕…** — lead + backend
- 🔴 **FUP-ACT-DISPOSE-UI** — LGPD Art. 18 referral-erasure has no UI route (authorized ∩ reachable = ∅); **PILOT-GATE CHECK, item 0 of [dm5-po-decisions.md](docs/progress/dm5-po-decisions.md) § "Remaining pre-pilot work"** — PO
- 🟠 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** — **PARTIALLY RESOLVED 2026-08-17 (`4102149b`); the filed remedy was WITHDRAWN as unbuildable** — lead/backend
- 🔴 **FUP-PGTAP-VACUOUS** — `lint:vacuous` scans TS specs only; ~6348 pgTAP assertions unscanned, live specimen in a PHI-boundary suite. The sweep must be **proven able to fail** first — lead/backend
- 🔴 **FUP-AFF-1** — the census is BLIND to write-path doors (ADR 0079 Am. 5); ⛔ cite `302`'s keystones, **never `ARM=census`** — backend/harness
- 🔴 **FUP-PCITV-1** — what QA APPROVED **over**, ranked: 5 open (TRUNCATE revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies) — unassigned
- 🔴 **FUP-ETH-ROLES-1** — no production bootstrap of `case_participant_roles`; the bundle lives only in `seed.sql` and `role_id` is NOT NULL, so a real org starts with zero roles and every participant type dead-ends. Decide before a second org onboards — product/backend
- 🔴 **FUP-FF5-1** — patient-lane sublabel degenerate on the READ path (PO DEFERRED; resolve before the lane reaches a real committee) — backend
- 🟠 **FUP-DM5-STORAGE-ORPHANS** — ✅ **Local half CLOSED empty by measurement 2026-08-17** — lead/backend
- 🟠 **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** — **a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with no manifest, no count comparison, no audit — the event ADR 0120 D9 exists to prevent, inside the slice tha** — lead/backend
- 🟠 **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** — **once `…000400` applies, `capture` prints `CAPTURE CLEAN` and the only arm that can still see a surviving byte is the volume `walk`, which is `STORAGE_BACKEND=file` local-only ⇒ on Cloud, pos** — backend
- 🔴 **FUP-DM5-NO-ANSWER-VS-NOTHING** — ⭐ **THE CLASS: an observable PROXY is substituted for the property that actually matters.** — backend/lead
- 🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** — **a Storage backup is an unmanaged plaintext PHI export, and the S5 drill created one (245 files, 68 PHI-tier, no RLS, no audited door, no TTL). The widest PHI egress path the system has. ✅ Al**
- 🟠 **FUP-DM5-DISPOSAL-JOB** — ⭐ **CRITICAL FUP C1, split into C1a (local) + C1b (Cloud) on 2026-08-18; the pilot bound is C1b.**
- 🔵 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — **⚠ HALF RESOLVED 2026-08-17 (`24cee179`): the fail-open half is fixed and proven; the arm is still a no-op pending a NAMED successor (deliberately not re-pointed — a successor must be named,…** — backend
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — ✅ **DECIDED 2026-08-18: BUILD IT, at retention expiry** — backend
- 🟠 **FUP-DM5-SIBLING-GUARD-DIFF** — **no authz arm can see a door that OMITS a check its siblings all make** — lead/backend
- 🟠 **FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION** — **NEW 2026-08-18**, found while closing the item above: `can_view_printed_document`'s `staff_admin` arm requires `status='submitted'`, and that predicate **is** the `printed_documents_select` policy ⇒ a print of an `in_progress` draft is visible to **its creator only**. Live today, no deletion involved — lead/PO decision, then backend
- 🟡 **FUP-ACL-APP-POPULATION** — the DROP+CREATE → PUBLIC-EXECUTE mechanism has fired **3×**, and the **`app`** schema has no generic net (`100` t19 is `public`-bounded; `320`'s is an 8-name allowlist) — backend
- 🟡 **FUP-PGTAP-WORKER-DEADLOCK** — `test:db` intermittently deadlocks a `pg_prove` worker; **assurance, not correctness** (a dropped suite is not a passed suite). ⛔ Never pipe the run through `tail` — backend
- 🟡 **FUP-PGTAP-SAVEPOINT** — ⚠ **DOWNGRADED 🔴→🟡: the original claim was WRONG.** TAP output cannot be rolled back; real only in the degenerate all-assertions-inside case — lead
- 🟡 **FUP-ROTATION-BREAKS-LINKS** — **474 broken relative links across the four rotation destinations, measured 2026-08-17.** — lead
- 🟡 **FUP-VACUOUS-COVERAGE-1** — **`phi-remediation` REM-8/REM-9 are honest `test.skip()`s that never run, so they are outside the vacuity property and `lint:vacuous` can never catch them. ✅ Body written 2026-08-17 (it had no** — tester/backend
- 🟡 **FUP-329-ABORT-SHAPE** — a `329` keystone whose failure **aborts the file** (drops 41 assertions), making a mutation sweep over those gates unclassifiable — backend
- 🔴 **FUP-DM4-PRODROW** — ⭕ **UNBLOCKED 2026-08-18: the probe answered its blocker (no Cloud orphan surface), and this item's "~49 vanished" figure is WITHDRAWN as unsound arithmetic.** The subject is still erased, not reconciled — lead/backend
- 🟡 **FUP-E2E-REPEAT-FLAKY** — ⭕ **TWO members: `act-role-assumption:157` + `phase2-auth-shell:268`** — lead/tester
- 🟡 **FUP-E2E-SERVER-DEAD-1** — the prod-standalone server dies under load in ~3 of 17 batches; `BATCH_TESTS=22` rescues. Infra, never an assertion failure — **but a batch with no verdict is not a pass** — unassigned
- 🟡 **FUP-E2E-PRINT-POOL-DEVLOOP** — **`submittedResponseIds` claims the print fixture pool by POSITION (`order=id.asc`), so a second `npx playwright test e2e/pdf-printing.spec.ts` without a reset reds at `:47`. Mechanism PROVEN…** — tester
- 🟡 **FUP-GATE-PDFP1-FLAKE** — `pdf-printing.spec.ts:38` empty-state flake; ⚠ mechanism **UNPROVEN** and both evidence artifacts were overwritten by the re-runs. Real fix: the gate script must archive a failing batch's log + `test-results/` **before** any re-run — lead/tester
- 🟡 **FUP-LINT-STALE-SYMBOL-COMMENT** — a 6th lint gate for comments naming deleted identifiers. ⚠ **Lead recommendation: do NOT build** (43% coverage ceiling) — lead/PO
- 🟡 **FUP-DM3-ETHICS-UI** — no affordance attaches an ethics decision letter; DM3 ships the seams API-writable only. Deliberate scope boundary — PO
- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators see ~only themselves in the CAPA assignee picker (`profiles` RLS has no operator arm) — backend
- 🟡 **FUP-ACT-HATLESS-AUDIT** — `audit_write` omits the `acting_as` KEY when hatless, conflating three meanings (Rule 11 met; legibility) — backend
- 🟡 **FUP-SILENT-READ-1** — ~207 of 773 PostgREST reads never destructure `error`, so empty is indistinguishable from failure. Per-call-site triage, **not** a bulk fix — unassigned
- 🟡 **FUP-ETH-KBD-1** — the professional lane's `TypeaheadField` was never keyboard-navigated, so BUG-ETHE4-FOCUS-1's defect is **untested, not ruled out** there — frontend/tester
- 🟡 **FUP-ETH-A11Y-1** — ETH·E4 dialogs: `aria-describedby` never reaches the error id; the typeahead announces neither loading nor result count — frontend/tester
- 🟡 **FUP-PDF-4** — `/verificar` rate limiter: ⛔ the filed premise was wrong (per-credential limiting already shipped); the real gap is the exhaustible **global** arm + per-process state — backend
- 🟡 **FUP-AFF-3** — pin door ACLs by DERIVING the door set from `pg_proc`, not by remembering it — backend
- 🟡 **FUP-AFF-4** — make the membership-role list a Postgres ENUM (decide before the role set next changes) — backend
- 🟡 **FUP-AFF-2** — D7's foreign-professional (no-CPF) escape is unreachable; decide before clinical staff onboard — product/backend
- 🟢 **FUP-QO-6** — oversight-toggle slow-confirm: annoyance severity ACCEPTED provisionally (PO); LOW, DB-vs-UI unclassified — tester
- ▶ **FUP-MIN-CUTOVER** — audio-minutes pre-enable gates (storage cap ⛔ BLOCKED on a Pro-plan decision · T5 smoke · R2 hardware look · deploy env vars) — lead + human
- ▶ **FUP-FF5-2** — §O pins the door's behaviour, not the closure of the `participants` writer set (assert count AND name; `\y` not `\b`) — backend
- ▶ **FUP-E2E-1** — RE-BASELINE `e2e:prod`: a named failure list, not a count (PO-ruled; blocks nothing) — tester
- ▶ **FUP-FF2-3** — whitespace-only observation filtered top-level but not per instance (legacy rows only) — backend
- ▶ **FUP-FF1-2** — FF-1 QA non-blocking items: 4 MINOR / 3 INFO — backend
- ▶ **FUP-FF1-1** — coherent fill-path hardening as one change (post-pilot; ADR 0087 ruling 5) — backend
- ▶ **AUTHZ Gate-2 MINOR-1** — reserved-session door returns the respondent's own `case_id` (fold at pilot close) — backend
- ▶ **ETH E1→E2 inheritance** — GAP-E1-1/2/3 + MINOR-A/B + participant-roles M2M, PO-routed to E2 — backend/frontend

_Resolved, rotated out of both live files → [follow-ups-archive.md](docs/progress/follow-ups-archive.md):
**FUP-DM1-CEILING · FUP-DM1-E2E · FUP-DM1-DISPOSE** (discharged by DM2 S1/S4/S2) · **FUP-F2-BUCKETS**
(`meeting-attachments` retired in `20260921000300`, pinned by pgTAP `325`) · **FUP-PDF-3** (both doors
now `RETURNS public.printed_document_public`; ADR 0111, pgTAP `323`)._

_14 more index lines (the 2026-08-18 resolved set, `FUP-DM5-*` and peers) rotated 2026-08-18 → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) § "Index lines rotated from PROGRESS.md 2026-08-18"; their bodies remain in [follow-ups.md](docs/progress/follow-ups.md) pending body rotation._

_Parked / deferred backlog — full detail (owner, rationale, repro) relocated to **[deferred-backlog.md](docs/progress/deferred-backlog.md)** to keep this tracker scannable; titles + pointers kept live below._

- [ ] **Ethics Committee track — E2 (procedure) + E3 (terminology/UX) remain; E0 (case-participants, ADR 0064) and E1 (access spine, ADR 0072) are COMPLETE** → [detail](docs/progress/deferred-backlog.md)

- [ ] **P7 — `audit_log` range-partitioning DEFERRED (lead decision 2026-07-05, pre-pilot hardening WS-5)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **D3 — jsonb/array → junction-table normalization DEFERRED to its own scoped plan (user decision 2026-07-05, pre-pilot hardening WS-3b)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **D7 — thread `p_hospital_id` for hospital-scoped NSP vocab. RE-SCOPED 2026-07-07: NOT backend-only — needs FE + a product decision (deferred)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS-3c FE follow-up — manual-CAPA UI should pass `p_hospital_id` for MULTI-hospital operators (backend, non-breaking). BLOCKED — confirmed 2026-07-07 (Batch B)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS-4 C-6 FE follow-ups — PHI-disposal UI + copy (backend + frontend; before the pilot exposes disposal UI)** → [detail](docs/progress/deferred-backlog.md)

- [ ] **Action-items hub — REMAINING satellites, adopt-on-demand (partner-handoff Phases 2–4; ADR [0050](docs/decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)). ⚠ NARROWED 2026-07-28: the S2·AI track shipped reminders + updates + checklists 2026-07-14 ([ai-satellites](docs/progress/ai-satellites.md)); only evidence, formal reviews, dependencies, per-committee custom fields, status/urgency management UI + effectiveness checks remain** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Break-glass access (logged, reasoned, time-boxed emergency access to restricted cases / PHI)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **User Registration — Phase-9 email-template deploy dependency (feature COMPLETE; deploy-time task)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Broader org-member-role-management UI (multi-tenancy gap; surfaced building NSP-per-org B3)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **NSP appoint-picker: annotate/exclude current org_admins (minor UX, NSP-per-org B3)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **`appointNspCoordinator` TOCTOU hardening (optional, NSP-per-org B3)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Multi-tenancy — org_admin TS-gate gap in the invoker `authorize*` helpers (QA INFO / lead #15, non-blocking)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Pre-existing full-serial-suite contamination (NOT a form-builder regression)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Harden `e2e/form-builder-enhancements.spec.ts` to a throwaway commission (QA INFO-4, nice-to-have)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **`case_patient` disposal UI — "Descartar dados do paciente" (frontend, not blocking; mirrors the NSP WS C item below)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS A FE — PQS-membership management UI (frontend, not blocking)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS A FE — `/admin/nsp` gating + patient-panel affordance (frontend/tester, surfaced by WS A trace 2026-06-20)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS E / M2 — per-vocabulary reorder/archive RPC consolidation DEFERRED (backend, 2026-06-20)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS B — authoritative PHI-bearing free-text column list (for ARCHITECTURE.md Rule 11/12 + ADR alignment, lead-owned). FINAL count = 22 columns** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS C FE — "Descartar dados do paciente" disposal UI (frontend, not blocking)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS B/C FE — discourage PHI in `*.title` / structured short fields (frontend, not blocking; surfaced 2026-06-20)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **E2E regression suite is NOT reliably green against a PROD build (test-harness debt, surfaced 2026-06-18; NOT a Phase-14 defect)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **E2E `case-narratives` AC-1b spec-isolation (tester-owned; surfaced 2026-06-19 during the case-access refinement triage)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Phase 14a deferred (QA re-verify INFO):** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Interviews — "Minhas entrevistas" discovery surface for plain-`staff` interviewers (Phase 11, deferred per lead)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys** → [detail](docs/progress/deferred-backlog.md)
