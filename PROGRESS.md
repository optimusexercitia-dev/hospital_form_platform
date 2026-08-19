# PROGRESS.md — Live Project State

> **LIVE STATE ONLY** — current phase and next actions, non-complete phase rows, OPEN
> bugs, the measured State block, Critical FUP, and the OPEN follow-up index. An entry
> leaves the moment its work merges and is recorded. Update state here first.
>
> **The contract lives elsewhere, deliberately** — judgment in
> [progress-contract.md](.claude/rules/progress-contract.md), mechanics in
> `npm run lint:progress` (gate 7), and **that script is the authority**. Restating a
> check here creates the second copy that drifts, which is what this file is recovering
> from: one claim about it was replicated into four documents and true in none.

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
- **✅ SHIPPED 2026-08-19 — the `Imprimir prévia` / `Emitir documento` split (ADR
  [0125](docs/decisions/0125-previa-ephemeral-and-emission-registered.md) +
  [0126](docs/decisions/0126-print-series-and-derived-currency.md)).** QA **APPROVED** r2
  ([review](docs/reviews/previa-split-review.md)). Branch `feat/previa-split-adr-0125-0126`,
  22 commits, **not merged, not pushed** — awaiting the merge call. Gate on a **fresh reset**:
  pgTAP **197f/6520** · seven lint gates · `tsc` · vitest **1447** · E2E **20/20** (six corridor
  cases, zero-leftover query) · **all four authz ARMs HOLD** · full 51-door row sweep ·
  **12 new `prosecdef` gates**, catalog-confirmed, none an INVOKER wrapper.
  **What it does:** a **locked** source yields a registered emission (QR, hash-pinned,
  verifiable); anything still editable yields an **ephemeral prévia** (streamed, no bytes at
  rest, no registry row, its own audit row). **The user never chooses** — and the **door**
  enforces it (`HC0DP` mint, `HC0DV` prévia), not the UI. Prints belong to a **series**, not a
  row; **currency is a third derived axis**, read-time and never stamped.
  ⭐ **Three live defects were found that no ADR anticipated**, each invisible to a green suite
  and each found by reading the **CALLER**: re-minting a reopened ata was **impossible through
  the UI** (`p_source_revision` never passed — D9's own corridor); a **locked source could be
  served as a prévia** (the door had no registration term at all — Rule 1); and the panel
  **promised a permanent verifiable record** above the prévia link.
  ⭐⭐ **The lesson, and it is the build's:** *a keystone proves the DOOR works and says nothing
  about whether the ACTION can reach it — the test is a **second caller**, and a second caller
  can satisfy a door the real one cannot even open.*
  ⚠ **ADR 0126 gained Amendment 1 (eleven findings)** — 2 PO-ruled extensions, **4 corrections
  to claims the ADRs state AS MEASURED**, 4 method rules, 1 live defect on the public page.
  **Residue, carried NOT inherited:** the commission-level cascade path stays open (its sibling
  is closed by measurement, 0125 Am. 1 §C), and `case`/`interview`'s lock/watermark/series
  declarations remain deferred to provider activation (0126 D7).
- **🆕 Five follow-ups filed during that build, NONE of them its subject, none fixed** — all
  measured, all with owners: 🔴 `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` (**blocks C1a/C1b**
  — `dispose_meeting_minutes` cannot complete on a locked meeting with agenda items; its own
  "bypass the freeze guards" comment is false) · 🟠 `FUP-42501-CONFLATES-GRANT-WITH-RLS` · 🟠
  `FUP-SUPERSESSION-BADGE-LANE-BLIND` · 🟡 `FUP-E2E-SUBMITTED-POOL-UNSCOPED` · 🟡
  `FUP-PREVIA-MINT-FLAG-ASYMMETRY`. Plus 🟡 `FUP-LINT-VECTOR-DIMENSION-DRIFT` (a gate proposal,
  filed not built).
- **▶ Next, in order** (PO-sequenced 2026-08-18; **the 0125/0126 build that jumped this queue
  has SHIPPED**, so these resume their order):
  1. **C1a** — local end-to-end run of
     [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md).
     ⛔ **BLOCKED, newly, by `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`** —
     `dispose_meeting_minutes` **raises** on any locked meeting that has agenda items, i.e.
     exactly the population carrying PHI. ⚠ **The rehearsal must name a locked meeting WITH
     agenda items as a fixture**, or it goes green having exercised only the case that works.
  2. **C2 Tier 1 sizing** (absorbs `Q1-OPEN-BYTES-CUT` + `SIBLING-GUARD-DIFF`).
  3. **`FUP-DM4-PRODROW`** — now actionable: re-derive a magnitude, or rule that it
     cannot be (TRIAGE #9 already forbids closing it as "reconciled").
- **✅ RESOLVED 2026-08-18 — the migration hold is discharged and the remote is CURRENT.**
  Remote head **`20260928000900`** / **415** applied (verified post-push). `…000600`/`…000700`
  turned out to be on the remote already — the "HELD" line was **stale**, the third time that
  claim has gone stale — and `…000800`/`…000900` were pushed on PO instruction. **0 local-only
  migrations.** ⛔ Re-measure `schema_migrations`; never re-read a sentence about it.
- **⚠ Three facts a session must not trip over** (full context in the
  [triage narrative](docs/progress/dm-fup-triage-2026-08-18.md)):
  1. The remote DB is **EMPTY** (reset 2026-08-17 11:37Z) — see § State; the safety
     of every remote action rests on that fact, and it **expires when the pilot
     loads data**.
  2. `DANGLING-PRINT` is **CLOSED** (ADR
     [0123](docs/decisions/0123-discarding-a-draft-that-has-emitted-documents.md));
     a third defect found during closure is now ✅ **CLOSED**
     (`FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION`, resolved 2026-08-19) — and it closed
     by **removing the subject**, not by widening a predicate: under ADR
     [0126](docs/decisions/0126-print-series-and-derived-currency.md) **D5** a draft no
     longer registers at all (`HC0DP`, DB-enforced), so there is no draft print to be
     invisible. Registration derives from the **lock point**: still-editable ⇒ ephemeral
     prévia; locked ⇒ registered — for meetings that turns at `in_signature`, which
     registers **stamped RASCUNHO**, watermark predicate unchanged.
     ⚠ **HC069 is genuinely unreachable now**, so `312` §9/§10 were rebuilt **table-level**
     with the t76/t80 differentials preserved (a rebuild that dropped them would be equally
     satisfied by a guard refusing every delete).
  3. **C1 split into C1a (local) + C1b (Cloud); the pilot bound is C1b** — a green
     local rehearsal does NOT release the pilot (§ Critical FUP C1).
- **✅ SHIPPED 2026-08-19 — the documentation-stability refactor** (ADR
  [0127](docs/decisions/0127-standing-rules-home-and-staleness-gate.md); ADR
  [0124](docs/decisions/0124-progress-live-state-contract.md) **Amdt 1**). This file
  **56.6 KB → 40 KB**. Standing rules moved to `.claude/rules/` — **4 admitted, 5 of 9
  rejected** (already gate-enforced, dead anchor, or no tight glob). `lint:rules` is
  **gate 8**; `lint:progress` gained cell/bullet shape caps and now link-checks the
  rotation destinations, which immediately found **41 links already broken** in two of
  them plus 3 orphaned anchors.
  ⛔ **The premise the refactor was proposed on was FALSE** — this file is **not** loaded
  by any spawn and never was (no `@`-import has ever existed). Always-loaded is
  CLAUDE.md 32 KB + MEMORY.md 20 KB, so cutting *this* file buys nothing at session start.
  ✅ **MEASURED 2026-08-19 — rules FIRE.** A fresh session touched PROGRESS.md and the probe
  logged `RULE · progress-contract.md · reason=path_glob_match · globs=PROGRESS.md,docs/progress
  · trigger=…\PROGRESS.md`. The feature flag is on; the earlier non-load was the mid-session
  creation, as hypothesised. The CLAUDE.md §8 intake line is **unblocked** (ADR 0127 Amdt 4).
  ✅ **Confirmed twice, incl. a SOURCE glob** (ADR 0127 Amdt 5): a fresh `claude -p` session
  reading `src/lib/queries/responses.ts` loaded `answer-maps.md` by `path_glob_match`. That is
  the case the §8 intake rests on — standing lessons are discovered in source, not in the
  tracker. ⚠ **Bounded: fresh sessions 2/2 fired; the resumed session that built this 0/3.**
  Unexplained, not guessed at. A rule is a strong hint, **never a substitute for a gate**.
  ⭐ Incidental: every `session_start` entry names exactly **two** files — user CLAUDE.md and
  project CLAUDE.md, **no PROGRESS.md**. The harness independently confirms ADR 0124 Amdt 1.
  ✅ **`.claude/rules/` now has a COMPLETE lifecycle** — intake (CLAUDE.md §8, unheld once
  firing was measured), staleness gate, volume bounds, and a **conditional** exit. ⛔ The exit
  is conditional for a reason: **nothing reads `rules-archive.md`**, so retiring a rule that is
  still true and enforced nowhere deletes the lesson, and `lint:rules` goes green either way.
  "Too broad but still needed" is **not** a retirement — it is a gate waiting to be built, or
  content that belongs in CLAUDE.md (ADR 0127 Amdt 2).
  **Filed, not built:** the 42501 gate (15 `throws_ok` sites) · staleness **domain (b)**,
  the docs that make claims about repo mechanics · MEMORY.md compaction (19.6 / 24.4 KB) ·
  a CLAUDE.md context program — the file where cutting bytes actually pays.
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

⛔ **Derive a rotation boundary by the PROPERTY (is this CLOSED?), never by markup.** Open bugs here
carry bold markers, not headings, so a sweep bounded by heading syntax archives them; this heading
exists because without it an open production blocker (BUG-BOOTSTRAP-001) read as filed under
*Closed*. Its provenance, and the three closed rows that were still listed here after the
2026-08-18 rotation put them in the archive, rotated 2026-08-19 →
[archive § "Rotated 2026-08-19"](docs/progress/bug-log-archive.md).

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

Closed rows and their closure narratives live in the archive. The standing **warnings**
this subsection used to hold were rules with no resolution event — which is why it could
only grow. Rotated verbatim 2026-08-19 and re-homed:

- **Path-scoped rule files**, loaded when you open the file they govern:
  [answer-maps](.claude/rules/answer-maps.md) · [radix-dialogs](.claude/rules/radix-dialogs.md).
  Staleness **and volume** gated by `npm run lint:rules`.
- **The `is_active` print-door prohibition was a rule for one day and is now RETIRED** —
  measured at **659 files** matched, and already enforced by pgTAP `342` S3c3. Full text +
  reasoning → [rules-archive](docs/progress/rules-archive.md).
- **Already enforced in code**, so no rule was written: the minutes `MINUTES_SERVICE_URL`
  precondition (fails fast in `e2e/meeting-audio-minutes.spec.ts`), the `set local` watermark
  (`lint:set-local`), the door-ACL census (pgTAP `320`).
- **Not admitted — no verifiable anchor:** *"date a log before citing it"* (its
  `batch-9-unrun.log` is untracked, so nothing could check it). Kept in the archive only.

## Test Run Summary

<!-- Most recent gate only, ONE ROW each. The narrative — triage, dispositions, mutation proofs —
     rotates to docs/progress/test-run-archive.md at each §6 Record (full history, Phases 0 →
     ACT, already there). -->
> **Retention: the most recent gate only.** Prior gate rows and their triage narratives →
> [test-run-archive.md](docs/progress/test-run-archive.md) (each rotation recorded there).

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-18 | **DM follow-up triage · LEAD** — the four shipped items (#2 byte proof · #4 DVF 1:1 · #8b draft-print delete guard · attachments deletion). Two fresh `supabase db reset --local` cycles; both new pgTAP arms authored **red-first** | **pgTAP 194 files / 6397 PASS** · **lint 5/5** · **typecheck 0** · **vitest 1305/1305** · authz `census`/`hat`/`floor`/`wrapper` all **INVARIANT HOLDS**. ⛔ **`e2e:prod` NOT RUN — this row is not a phase gate.** Full row → [archive](docs/progress/test-run-archive.md) |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| Prévia split — ADR 0125/0126 | APPROVED (r2) | 2026-08-19 | [previa-split-review](docs/reviews/previa-split-review.md) |
| _The seven DM rows_ — rotated 2026-08-19, the DM milestone being closed | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| _Verbose form of the 5 rows above, incl. both struck r1 rounds_ — rotated 2026-08-14 (§5: never restate rationale here) | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| 112 concluded rows | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-19 | ⛔ **"PROGRESS.md is loaded by every spawn" IS FALSE, and never was** — no `@`-import has ever existed. The claim sat in ADR 0124, the banner, the gate header and an external handoff. Always-loaded is CLAUDE.md 32 KB + MEMORY.md 20 KB; this file is read on demand | ADR [0124](docs/decisions/0124-progress-live-state-contract.md) **Amdt 1** |
| 2026-08-19 | **Standing rules move to `.claude/rules/` with `paths:`, admitted only if they declare checkable anchors and no gate already enforces them — 5 of 9 candidates REJECTED** (PO) | ADR [0127](docs/decisions/0127-standing-rules-home-and-staleness-gate.md) |
| 2026-08-19 | **`lint:rules` is GATE 8** — keystone: a rule whose own `paths:` glob matches zero files is orphaned. ⚠ Rule firing is **UNPROVEN** (feature-flagged); an `InstructionsLoaded` probe measures it | ADR [0127](docs/decisions/0127-standing-rules-home-and-staleness-gate.md) · CLAUDE.md §8 |
| 2026-08-19 | **Cell/bullet shape caps + link-checking of the rotation destinations added to `lint:progress`; the size RATCHET was declined** — it would red on recording new state, pressuring the OPEN index §7 protects | `scripts/check-progress-doc.mjs` |
| 2026-08-18 | ✅ **REGISTRATION DERIVES FROM SOURCE STATE, AT THE LOCK POINT.** Editable → **ephemeral, audited `Imprimir prévia`** (no registry row, no bytes, no QR); locked → registered `Emitir documento`. **Amends 0104 D7 knowingly.** ⚠ Makes **HC069 unreachable**; guard RETAINED as backstop | ADR [0125](docs/decisions/0125-previa-ephemeral-and-emission-registered.md) · amends [0104](docs/decisions/0104-pdf-document-printing-module.md) D7 · discharges [0123](docs/decisions/0123-discarding-a-draft-that-has-emitted-documents.md) D7 |
| 2026-08-18 | **PROGRESS.md becomes LIVE-STATE-ONLY, machine-enforced (`lint:progress`, gate 7); completed rows → phase-ledger.md; CLAUDE.md review cadence via Stop hook + `/review-claude-md`** (PO) | ADR [0124](docs/decisions/0124-progress-live-state-contract.md) |
| 2026-08-18 | **DM-FUP TRIAGE #1 — the Cloud orphan measurement must CONSTRUCT an orphan, not probe for one** (PO) | FUP-DM5-CLOUD-ORPHAN-SURFACE |
| 2026-08-18 | ✅ **MEASURED — Cloud exposes NO orphan-visible surface; all 5 surfaces METADATA-BOUND, both S3 auth modes.** The Cloud byte half is structurally unverifiable, so the runbook's *asserted, not verified* posture is evidenced. ⛔ Not reassurance: orphan bytes are **unobservable**, not absent | FUP-DM5-CLOUD-ORPHAN-SURFACE ⬛ · [run record](docs/progress/cloud-orphan-probe-2026-08-18.md) |
| 2026-08-18 | ✅ **`db push` EXECUTED on PO instruction — `…000800` + `…000900` applied; remote head `20260928000900` / 415.** Verified independently, not from the migration's own notice: first-party truncatable **63 → 0**, and `…000800`'s new DEFINER carries **no PUBLIC** in its ACL | FUP-PCITV-1 item 3 ⬛ · [backend-state.md](docs/backend-state.md) |
| 2026-08-18 | ✅ **TRUNCATE residue SWEPT (63 first-party tables) and the platform half ACCEPTED IN WRITING** — `20260928000900` + pgTAP `191` §5. ⭐ TRUNCATE fires no DELETE trigger, so it bypasses `storage.protect_delete` as well as RLS; the migration verifies the **EFFECT**, not the absence of an error | FUP-PCITV-1 item 3 ⬛ · FUP-DM5-STORAGE-ORPHANS |
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
| 2026-08-18 | ✅ **DM-FUP TRIAGE #8b — RE-RULED AND BUILT: refuse to DELETE a response that has an ACTIVE printed document** (PO), replacing the withdrawn #8. Migration `20260928000700` — `app.guard_response_active_print`, a BEFORE DELETE trigger raising `HC069`. | ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) D7 (preserved) · `20260928000700` |
| 2026-08-18 | ⚠ **THE #8b MIGRATION SHIPPED A PUBLIC-EXECUTABLE `SECURITY DEFINER` FUNCTION, AND A GATE CAUGHT IT — not review, and not foresight.** Created without an explicit ACL,… | FUP-ACL-APP-POPULATION · pgTAP `320` U1 |
| 2026-08-18 | ⛔ **DM-FUP TRIAGE #8 IS WITHDRAWN THE SAME DAY — it reverses a ratified decision, and NOTHING WAS BUILT.** | ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) D7 · FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT |
| 2026-08-18 | ~~**DM-FUP TRIAGE #8 — refuse a print mint from a non-`submitted` response**~~ ⛔ **WITHDRAWN — see the row above.** (PO). The narrowest of the three filed options, and the standing principle applies:… | FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT |
| 2026-08-18 | **DM5 GATE STEP 4 — ALL SEVEN DOCKET ITEMS RULED** (PO) | [phase review](docs/reviews/dm5-phase-review.md) §§5–6 · § Critical FUP |
| 2026-08-18 | ✅ **`db push` EXECUTED — all five local-only migrations applied to the remote** (PO-authorized at the docket, to carry out decision #1) | § "State" (a TOP-LEVEL section since 2026-08-18) |
| 2026-08-18 | **#4 SUPERSEDE COLLISION RULED as (b) — supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 2** · ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D11 |
| 2026-08-18 | 🔒 **#7 PILOT RISK ACCEPTED, BOUNDED BY ONE REHEARSAL** (PO) — the pilot may proceed over the manual-only PHI-disposal path **on the condition that `phi-disposal-runbook.md` runs end-to-end against**… | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 3** · **Critical FUP C1** |
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
- 🔴 **FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE** — ⛔ **BLOCKS C1a/C1b.** `dispose_meeting_minutes` sets `app.in_meeting_rpc` with the comment *"bypass the meeting freeze guards"* — **`app.guard_meeting_child_lock` does not read that flag** (measured from `pg_get_functiondef`; it is on 4 child tables). So the door nulls `minutes_md`, then **raises** on the agenda UPDATE and rolls back: **PHI erasure is impossible for any meeting at `in_signature`+ that has agenda items**, i.e. exactly the population that carries PHI. Constructed with 3 probes (with-agenda ⛔ raises · agenda-less ✅ disposes). ⚠ **The C1a rehearsal must name a locked meeting WITH agenda items as a fixture** or its green proves nothing. Fix is a real design question (3 shapes, none ruled — option 1 is a widening) — backend/PO
- 🔵 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — **⚠ HALF RESOLVED 2026-08-17 (`24cee179`): the fail-open half is fixed and proven; the arm is still a no-op pending a NAMED successor (deliberately not re-pointed — a successor must be named,…** — backend
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — ✅ **DECIDED 2026-08-18: BUILD IT, at retention expiry** — backend
- 🟠 **FUP-DM5-SIBLING-GUARD-DIFF** — **no authz arm can see a door that OMITS a check its siblings all make** — lead/backend
- 📦 **Deferred backlog — 33 open items (🟡 24 · 🟢 1 · ▶ 8)**, moved out of the live index 2026-08-19: open, but not actionable next session. Severity · id · claim preserved verbatim → [deferred-backlog.md](docs/progress/deferred-backlog.md)
- 🔴 **FUP-DM4-PRODROW** — ⭕ **UNBLOCKED 2026-08-18: the probe answered its blocker (no Cloud orphan surface), and this item's "~49 vanished" figure is WITHDRAWN as unsound arithmetic.** The subject is still erased, not reconciled — lead/backend
- 🟠 **FUP-42501-CONFLATES-GRANT-WITH-RLS** — ⛔ **coverage defect, NOT a vulnerability** (both tables ARE protected, by the missing grant). `42501` is both the RLS-refusal code AND Postgres's generic *permission denied for table*, so `throws_ok(…,'42501')` cannot tell them apart. Measured: of **12** live assertions in `252_authz_p0_isolation.sql`, `authenticated` lacks INSERT on **`rca_evidence`** + **`capa_action_evidence`** ⇒ those two pass on the **grant**, never reaching RLS. The P0 suite claims isolation on 12 tables and demonstrates it on **10**. ⚠ The tree already documented this trap **twice in prose** (`301`:21, `277`:328) and it recurred anyway. ⛔ Do NOT fix by granting INSERT — that widens real protection to make a test honest; fix the assertion. Model fix + the allow-leg differential that caught it: `345_previa_audit_door.sql` header. ⭐ **2026-08-19: filed as a GATE proposal, not a rule** (ADR 0127 rejected the rule form — a gate beats a rule where one is reachable). Measured population: **15 `throws_ok` sites carry a bare `'42501'`**, of 728 total references — so the gate costs 15 remediations, which is why it is a proposal and not built — backend/tester
- 🟠 **FUP-SUPERSESSION-BADGE-LANE-BLIND** — `resolveSupersessionBadge` (`queries/submissions.ts`) mirrors `app.submitted_form_responses`' exclusion but **drops that rule's own `case_phase_id is null`**, while `listSubmissions` surfaces BOTH lanes. Standalone = correct (it IS ADR 0126 Am.1 §A's rule); **phase-bound = the chain-tip grain D8 examined and REJECTED** — the original reads "Substituído" before approval while `current_response_id` still points at it, flaps back on `reject_correction`, and an unapproved successor reads "Atual". ⭐ Differential: the **same pill** one file over is fed by `status === "approved"` (ADR 0085). ⭐⭐ And the lane conjunct **already exists in TS**: `isDashboardCountable` (`queries/dashboard.ts`) — which ARCHITECTURE.md calls *"the TS twin"*, singular — has `r.casePhaseId == null` explicitly, one file away. Two TS derivations of one choke-point; only one is sanctioned and only one is complete. ⚠ ADR **0074's** axis, not print-currency; found by accident in the §K sweep. ⛔ Read ADR 0074/0085 before fixing. Class: **a mirror inherits its source's PREDICATE, not just its shape** — frontend/backend

_Resolved, rotated out of both live files → [follow-ups-archive.md](docs/progress/follow-ups-archive.md):
**FUP-DM1-CEILING · FUP-DM1-E2E · FUP-DM1-DISPOSE** (discharged by DM2 S1/S4/S2) · **FUP-F2-BUCKETS**
(`meeting-attachments` retired in `20260921000300`, pinned by pgTAP `325`) · **FUP-PDF-3** (both doors
now `RETURNS public.printed_document_public`; ADR 0111, pgTAP `323`)._

_14 more index lines (the 2026-08-18 resolved set, `FUP-DM5-*` and peers) rotated 2026-08-18 → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) § "Index lines rotated from PROGRESS.md 2026-08-18"; their bodies remain in [follow-ups.md](docs/progress/follow-ups.md) pending body rotation._

_Parked / deferred backlog — full detail (owner, rationale, repro) relocated to **[deferred-backlog.md](docs/progress/deferred-backlog.md)** to keep this tracker scannable; titles + pointers kept live below._

- 📦 **Parked backlog — 27 items**, index and full detail (owner, rationale, repro) → [deferred-backlog.md](docs/progress/deferred-backlog.md)


