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

- **No phase is active.** The **DM program (DM0–DM5) is COMPLETE** — closed 2026-08-18, all five
  gate steps, phase QA APPROVED r2 ([review](docs/reviews/dm5-phase-review.md)); its follow-up triage
  ruled eleven items and shipped five. ⛔ *The standing-green E2E figure this bullet used to carry
  (the 2026-08-17 run, 1121p/0f) is **SUPERSEDED** — see the 2026-08-20 gate below, which is RED.*
- **✅ CONCLUDED 2026-08-18 — the Cloud constructed-orphan probe.** Cloud exposes **no orphan-visible surface** (all 5 metadata-bound), so the byte half is structurally unverifiable and the runbook’s *asserted, not verified* posture is evidenced; `FUP-DM4-PRODROW` **unblocked**, its "~49 vanished" figure **withdrawn** (§ State). ⛔ Not reassurance — orphan bytes are **unobservable, not absent**. Narrative rotated 2026-08-20 → [cloud-orphan-probe-2026-08-18.md](docs/progress/cloud-orphan-probe-2026-08-18.md).
- **✅ CONCLUDED 2026-08-19 — the `Imprimir prévia` / `Emitir documento` split** (ADR
  [0125](docs/decisions/0125-previa-ephemeral-and-emission-registered.md) +
  [0126](docs/decisions/0126-print-series-and-derived-currency.md)): shipped, QA **APPROVED** r2,
  **merged and pushed** (`9ed197d5`), branch gone. A locked source yields a registered emission; an
  editable one an **ephemeral prévia** — and the **door** enforces it, not the UI. ⭐ Its lesson,
  kept here because it is not print-specific: *a keystone proves the DOOR works and says nothing
  about whether the ACTION can reach it — the test is a **second caller**, and a second caller can
  satisfy a door the real one cannot even open.* ⚠ ADR 0126 **Amdt 1** carries eleven findings,
  **four of them corrections to claims the ADRs state AS MEASURED**. Full narrative rotated
  2026-08-20 → [previa-split-2026-08-19.md](docs/progress/previa-split-2026-08-19.md); residue
  (commission-level cascade path; `case`/`interview` lock declarations, 0126 D7) stays open there.
- **🆕 Six follow-ups from the ADR 0125/0126 build, none of them its subject** — one ✅ RESOLVED
  (`FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`, ADR 0129 / DSR Slice 1; ⚠ its "blocks C1a/C1b"
  claim was **wrong in grain**). The other five are now **all carried in § Follow-ups** — ⛔ three
  of them had a body but **no index line**, and this bullet was their only live trace (see below).
- **🆕 DSR ("Direitos do Titular") — designed 2026-08-19; ✅ ALL FOUR SLICES BUILT (19th / 20th
  ×3); there is no Slice 5. ⛔ What is pending is the GATE, not the build** — steps 4 (PO approval)
  and 5 (record + rotation) are owed, and nothing is merged or pushed.
  ⚠ *Corrected 2026-08-20: this bullet read "the program is complete" while a sentence 50 lines below
  it said Slice 4 was at QA r1 — **three conflicting statuses written into one commit** (`3d5e9a9c`).
  A tracker that contradicts itself in one section is read by whichever line the reader reaches first.*
  Sixteen PO-ratified decisions in a structured
  design session: an **adjudicated DSR workflow** (refusal-with-basis first-class), a per-hospital
  **`dpo` capability**, one task inbox at `/o/[org]/titulares` (flag `dsr`), hash-only DSR record
  (Rule 12's "exactly three" survives), two-tier erasure claim, zero disposal-gate widenings, and
  the **child-lock fix ruled as shape 2** (narrow `app.in_disposal_rpc`). ADRs
  [0129](docs/decisions/0129-meeting-child-lock-disposal-flag.md) +
  [0130](docs/decisions/0130-dsr-subject-request-workflow.md) — **0129 Accepted/BUILT**; **0130
  moved Proposed → Accepted 2026-08-20 on PO instruction, lifting the build hold**;
  ✅ **counsel's Q14 return ARRIVED same day** (ADR
  [0035](docs/decisions/0035-lgpd-anvisa-regulatory-posture.md) **Amdt 1**, resolved): committee
  records are **NOT prontuário** (CFM 1821 does not attach); removal requests **case-by-case with
  legal consultation** (supersedes the blanket override); **20-yr retention adopted by default as
  institutional policy**. Refusal guidance settled via ADR 0130 **Amdt 1** (+
  `legal_consultation_ref` on adjudicated outcomes — required/optional split to confirm at
  kickoff). **Nothing blocks on counsel.**
  ✅ **SLICE 1 SHIPPED 2026-08-19** — migration `20260930000100`, suite `348` (15 tests); gate green
  on a fresh reset, fix verified by **neutralization in both directions**. ⛔ **It does NOT unblock
  C1a** — that link was wrong in grain (§ Now item 1); what it fixes is **meeting-minutes erasure**.
  ⭐ The sweep found a second thing: `dispose_meeting_minutes`'s own authz gate was **door-blind**
  (opened, 6548 tests stayed green) — keystoned as `348` t7; sibling census filed
  `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND`, **still open** (349 exercises the referral door, not the event door).
  ✅ **SLICE 2 SHIPPED 2026-08-20** — migrations `20261001000000`–`…000200`, suite `349` (53 tests),
  E2E `dsr-subject-requests.spec.ts` (5), `/o/[org]/titulares` + `src/lib/dsr/`. Gate on a fresh
  reset: pgTAP **200f/6603 PASS** · eight lint gates · `tsc` · vitest **1447** · **all four authz
  ARMs HOLD** · diff-scoped door sweep over the 6 new in-domain gates: **6 COVERED, 0 BLIND**.
  ⛔ **Gate step 3 (QA review) was NOT run, and steps 1–2 were run by the lead, not by the
  `tester`/`qa` teammates** — no independent review of this slice exists. Stated here because a
  gate record that names only what passed reads as full coverage.
  ✅ **Pilot-gate item 0 (`FUP-ACT-DISPOSE-UI`) is DISCHARGED** — `pqs.a@test.local` reaches the
  inbox AND passes `dispose_event_phi`, both halves executed **in a browser**; written into its own
  row ([dm5-po-decisions.md](docs/progress/dm5-po-decisions.md) item 0), bounded to the **event**
  lane, meetings explicitly NOT claimed.
  ⭐ **Three things the build found, none of them its subject:** `patient_xref` keys the **case**
  module on a `patient_participants` id, not a case id (believing the module name would have shipped
  a case lane failing **closed forever and silently**); `hospital_dpos_select` was **BLIND** when
  first written; and the first neutralization harness's **"restore" was a silent no-op**, so five
  sweeps accumulated — *a rollback you have not watched succeed is not a rollback*. Four shape
  changes are in **ADR 0130 Amendment 2**; read it before extending.
  ✅ **SLICE 3 SHIPPED 2026-08-20 — QA APPROVED (r2), PO-approved.** Migrations `20261002000000`–`…000300`,
  suite `350` (**75 tests**), 4 E2E specs (**37**), the DPO lane + `/o/[org]/titulares/[requestId]`, the
  attested tier, the refusal-retirement, and `disposeMeetingMinutes` — **ADR 0056 Consequence (a), never
  built until now and now reachable** (it shipped *unreachable*: adjudication posted the wrong id, BUG-DSR-S3-001).
  Plus the **`useFieldIds` `name` inversion** (43 files, 30 annotated call sites, PO-ruled).
  **Declaring gate, tree HASH-VERIFIED unchanged throughout:** pgTAP **6678/6678** · 8 lint gates · `tsc` ·
  vitest **1448** · **all four authz ARMs hold** · `e2e:prod` with **only the 2 pre-existing
  `quality-oversight` failures** (BUG-QO-STALE-CASOS) — **no DSR spec failed**.
  ⛔ **Do NOT cite "all four authz ARMs hold" as coverage for this slice.** The diff-scoped case list came
  back **EMPTY** — every changed object is a `prosecdef` scalar non-bool command door, outside every arm's
  domain (**Critical FUP C2**). Coverage is a **48-probe battery: 47 RED + 1 GREEN**, the GREEN recorded as a
  **finding, not a pass**. ⚠ **A RED is sound IFF its baseline was verified green** — a red baseline also
  yields a red post-probe run, which reads as COVERED (`FUP-AUTHZ-HARNESS-PRECONDITIONS`). All 48 clear that bar.
  **10 bugs found and closed inside the slice** (8 product, 2 spec) → [bug-log-archive.md](docs/progress/bug-log-archive.md);
  ⭐ **four were visible only by EXECUTING something** — no static gate saw them. Build detail, the ARM bound,
  the ACL over-grant and the harness proofs → [dsr-slice-3.md](docs/progress/dsr-slice-3.md).
  ✅ **SLICE 4 BUILT 2026-08-20 — QA APPROVED at r3** (r1 + r2 were CHANGES REQUESTED). **Its item 1 was
  WITHDRAWN, not built.** Measuring the premise
  before building falsified it: `notifications.entity_type`'s CHECK admits eight values and **`case`,
  `referral`, `event` are not among them**, so the prescribed scrub matched **zero rows by
  construction** for three of the four doors and its pgTAP pin would have been vacuous *by CHECK
  constraint*. The item's own cited evidence was false — **no notification writer reads `cases.label`**
  — and **no** notification text source is erased by **any** door. Established by constructing the
  state (both inserts refused; `meeting` insert as positive control), not by reading the constraint.
  Items 2+3 collapsed into one real change: `referral-dispose-dialog.tsx` now renders the shared
  `DSR_RESIDUE_NOTICE` with both over-claims **replaced**. ⭐ *The design was inferred from column
  names — `entity_type`/`entity_id` read as a polymorphic handle to the disposed entity — and was
  internally coherent the whole time.* ADR [0130](docs/decisions/0130-dsr-subject-request-workflow.md)
  **Amdt 4**; successor was `FUP-DOOR-ERASURE-FREETEXT-CENSUS` — ✅ **censused, then RULED OUT OF
  SCOPE 2026-08-20** (ADR [0131](docs/decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md):
  erasure reaches **designated PHI fields only**; free text is a **training** control). ⛔ Closed by
  ruling, **not** by "nothing found" — 133 columns measured and **accepted**, record retained.
  **r2 → r3.** ✅ **B1 + B2 both discharged.** B1 (a false ACL claim in an Accepted ADR)
  corrected in all three copies — ⭐ *`attacl` belongs beside `relacl`*: a **column** grant
  (`read_at = authenticated=w`) is invisible in `pg_class.relacl`, and it slipped into the very
  sentence claiming the enumeration was *bounded*. B2: the meeting door was **WIDENED** (PO-ruled) —
  10 columns, not the 4 the follow-up listed, incl. depth-2 closed-session prose and **jsonb**
  minutes text (*free text is not a type*). ⛔ **Biggest find of the slice:** a minutes job resting in
  **`done`** kept the **verbatim meeting transcript** indefinitely — falsifying ADR 0056 **§4**, not
  just the residue copy; now purged unconditionally. pgTAP `351` (lead-verified: 202 files / **6711**
  / PASS), 17/17 probes RED on a **locked** fixture. ⛔ `ARM=census`/`wrapper` are green and
  **vacuous here** — neither changed function is in *those two* arms' domains (the guards return
  `trigger`, the door returns `void`); ⚠ **not "no arm"** — `ARM=floor` does contain
  `dispose_meeting_minutes` (QA r2). Cite pgTAP **351**, never the arms.
  ⚠ **No E2E reaches the changed dialog at all** (`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE`), so the
  15 mutation-proven component tests are the only executable proof — a jsdom render is not a browser.
  ⭐ **QA r3's three non-blocking findings N12/N13/N14 were BUILT and recorded NOWHERE** — an APPROVED
  verdict absorbed them, and they survived only because someone re-read the review. Measured in the tree
  2026-08-20, all three already in `3d5e9a9c`: `351`'s anchor comment now says Farmácia B **"ranked 4 of
  4"** (N12); `351` t7 asserts `app.is_staff_admin_of` **under the persona's own claims**, plus a
  SINGLE-ROLE anchor clause — *a membership row is not the door's gate* (N13); both `grantable` copies
  read **GRANTED** (N14). ⛔ What was owed was the **record**, not the work — yet "filed nowhere" was
  carried for a day as "unbuilt", which would have re-done all three.
  **▶ Resume: gate step 4 (PO approval) → step 5 (record + rotation) → merge + push.**
  ⛔ **Not merged, not pushed**; local `main` is separately ahead, unpushed. ⛔ **No commit count
  appears here, deliberately** — measure it (`git rev-list --count origin/main..HEAD`). This line
  carried **9** with "4 uncommitted files" (both false within the day), was corrected to **13**, and
  the correcting commit made it **14** in the same act. A count in a tracked file is stale by
  construction; § Bug Log declines to carry one for the same reason.
  ✅ branch renamed 2026-08-20 to `feat/dsr-subject-request-workflow` — the old name said "slice-2"
  while carrying all four slices.
- **▶ Next, in order** (PO-sequenced 2026-08-18; **the 0125/0126 build that jumped this queue
  has SHIPPED**, so these resume their order):
  1. **C1a** — local end-to-end run of
     [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md).
     ⛔ **STILL UN-RUN, and nothing about it changed on 2026-08-19.**
     ⭐ **CORRECTION (2026-08-19, measured):** `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` was
     recorded as **blocking C1a/C1b**. It did not. C1a is *a run of this runbook*, and the runbook
     is the **`file_objects` / Storage-bytes** completion mechanism (§ 0: it exists because
     `complete_document_disposal` has no automated caller). The two paths are **disjoint** in the
     catalog: `dispose_meeting_minutes` writes **no** `file_objects` row and never sets
     `disposal_pending`; `complete_document_disposal` never touches meetings; the runbook contains
     **zero** occurrences of "meeting", "minutes_md" or `dispose_meeting_minutes`. The child-lock
     defect was real and is **fixed** (ADR [0129](docs/decisions/0129-meeting-child-lock-disposal-flag.md),
     DSR Slice 1) — it blocked **meeting-minutes erasure**, not this rehearsal. *A real defect was
     cited for a conclusion it did not bound, and the error ran in the reassuring direction: it made
     C1a look blocked-then-released rather than simply never started.*
     ⚠ Whoever runs C1a: the fixture caveat belongs to **meeting** disposal, which this runbook does
     not cover at all — see 🟠 `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`.
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

🔴 **BUG-QO-STALE-CASOS — `quality-oversight.spec.ts` asserts coordinator WRITE affordances on
`/casos`, which `8675b7cd` (2026-08-19) deliberately made a READING surface. `main` is E2E-RED.**
Filed 2026-08-20 (lead) during the DSR Slice 2 gate. Two tests fail — `:569` "no-lockout control"
(header `Editar` absent) and `:627` "Reabrir caso" pairing — both navigating `${CCIH}/casos/<id>`.
**Not a DSR regression: proven by control.** Stashing the entire slice (`git stash -u`), clearing
`.next`, rebuilding and re-running the spec alone on a fresh DB reproduces **the same two failures,
19 passed / 2 failed**, identical to the run with the slice present. Seed state matches the tests'
premises (case 1 `pending`, case 2 `completed`), and the affordances still exist — on
`/manage/cases/[caseId]/(detail)`, where that commit moved them. ⚠ **The repair is not "change the
URL": the test's PURPOSE was to pair a coordinator against `quality.a`'s absence check on the SAME
url, and if `/casos` is now read-only for everyone that pairing has gone VACUOUS** — it would pass
while proving nothing. Owner: whoever owns `8675b7cd`; the E2E baseline is red until then.

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

🔴 **BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE — `ReferralDisposeDialog`
(`src/components/referrals/referral-dispose-dialog.tsx`) has never run in a BROWSER; no
E2E test has ever rendered its trigger button, let alone opened the dialog.** ⚠ **Retitled + narrowed
2026-08-20 (lead), same day it was filed as `…-ZERO-COVERAGE`:** that title was true when written and
false hours later — `referral-dispose-dialog.test.tsx` now pins the residue lines, the over-claim
property, the confirm/submit gating and both `aria-describedby` arms in **15 tests, all
mutation-proven to fail** (11 mutations, each red under an anchor-uniqueness guard). **What remains is
exactly the browser half:** real focus behaviour in the new block, Radix portal semantics, and the
end-to-end confirm→submit→server-action path. ⛔ *A jsdom render is not a browser* — do not read the
component tests as discharging this. Everything below stands as the mechanism. Filed 2026-08-20
(tester) during the DSR Slice 4 verification (markup-only change: the `DSR_RESIDUE_NOTICE` `<ul>` +
a conditional `subject_request` note; trigger/confirm-phrase/button-label locators deliberately left
unchanged per `docs/plans/dsr-workflow-plan.md` § Slice 4 item 3, precisely to avoid re-scoping E2E).
**Mechanism:** the component holds no gate of its own — it renders unconditionally once mounted, and
the PAGE alone decides whether to include it, on the authoritative `canDisposeReferralPhi` probe.
Under the ADR 0106 (D5) strict single-hat model, **no seeded persona can simultaneously reach**
`encaminhamentos/[id]` **and** satisfy that probe — every hat that reaches the route fails the RPC
gate, every hat that passes the gate 404s on the route (documented in-spec at
`e2e/nsp-per-hospital.spec.ts:948-959` as `FUP-ACT-DISPOSE-UI`). Confirmed by grep across the whole
`e2e/` tree: all three `getByRole('button', {name: /apagar dados do paciente/i})` assertions that
exist (`nsp-per-hospital.spec.ts:939`, `:970`, `:1040`) assert `.toHaveCount(0)` — none asserts
presence, anywhere. AC-7's mutating disposal test (`:995`) bypasses the component entirely, POSTing
straight to `/rest/v1/rpc/dispose_referral_phi`; AC-8 was re-pointed at an unrelated PHI-reveal
button for the same reason. **Impact:** the confirm/submit path (pick reason → type `APAGAR` → click
"Apagar definitivamente") and the new residue-notice markup Slice 4 just shipped have never run in a
browser. A regression that broke the confirm button, trapped focus in the new block, or dropped the
`aria-describedby` wiring would ship green — the same "no persona can reach it" shape that let the
now-closed `FUP-DISPOSE-DIALOG-OVERCLAIM` copy defect sit unnoticed in this exact dialog since it
shipped.
⚠ **Not a Slice 4 regression** — Slice 4 changed no locators and this gap predates it; root cause is
the ADR 0106 re-scope. Verified this run: `e2e/nsp-per-hospital.spec.ts` AC-7 (3 tests) + AC-8 (1
test) all pass on a fresh reset (`4 passed`, single-worker) — proving the RPC/audit/redaction
mechanism and the PHI-reveal keyboard flow, **not** the dialog UI; do not cite this green as UI
coverage.
**Status:** OPEN, unassigned. Relates to the referral lane of `FUP-ACT-DISPOSE-UI` (pilot-gate item
0, `docs/progress/dm5-po-decisions.md`) — discharged only for the **event** lane
(`dispose_event_phi` via `pqs.a@test.local`); the referral lane was never claimed and remains open.
Two candidate dispositions, PO/lead's call: (a) name or build a fixture persona with simultaneous
route-access + disposal-entitlement (commission member AND tenancy-admin/PQS-operator on the source
hospital, without a hat-switch) so a real browser flow can drive the dialog — a `seed.sql` change,
backend's to make, not tester's to force unilaterally; or (b) accept the gap and rely on
lint/tsc/code-review/a component-level test in place of E2E for this control, and say so explicitly
wherever this dialog's verification is cited.

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
| 2026-08-20 | **DSR Slice 4 · LEAD — gate, all four re-run by the lead** | pgTAP **6711/6711** Files=202 · lint(8) **0** · `tsc` **0** · unit **1480/1480**, real exit codes. **No e2e**: nothing reaches the changed dialog (`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE`); AC-7/AC-8 4/4 = route integrity only → [archive](docs/progress/test-run-archive.md) |
| 2026-08-20 | *(the DSR Slice 2 gate row rotated to [test-run-archive.md](docs/progress/test-run-archive.md) — superseded by the Slice 3 gate below)* | — |
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
| DSR Slice 4 — ADR 0130 Amdt 4 (r3) | **APPROVED** | 2026-08-20 | [dsr-slice-4-review](docs/reviews/dsr-slice-4-review.md) |
| ~~DSR Slice 4 — ADR 0130 Amdt 4 (r2)~~ | ~~CHANGES REQUESTED~~ | 2026-08-20 | [dsr-slice-4-review](docs/reviews/dsr-slice-4-review.md) |
| ~~DSR Slice 4 — ADR 0130 Amdt 4 (r1)~~ | ~~CHANGES REQUESTED~~ | 2026-08-20 | [dsr-slice-4-review](docs/reviews/dsr-slice-4-review.md) |
| DSR Slice 3 — ADR 0130 (r2) | **APPROVED** | 2026-08-20 | [dsr-slice-3-review](docs/reviews/dsr-slice-3-review.md) |
| ~~DSR Slice 3 — ADR 0130 (r1)~~ | ~~CHANGES REQUESTED~~ | 2026-08-20 | [dsr-slice-3-review](docs/reviews/dsr-slice-3-review.md) |
| _The seven DM rows_ — rotated 2026-08-19, the DM milestone being closed | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| _Verbose form of the 5 rows above, incl. both struck r1 rounds_ — rotated 2026-08-14 (§5: never restate rationale here) | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| 112 concluded rows | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-20 | **PO: PHI erasure reaches DESIGNATED PHI fields ONLY** — free text/titles that *may* hold PHI are out of pilot scope; the control is **training**. Shipped reach MAINTAINED, not rolled back. Closes the census + ethics items **by ruling, not remediation — the residue is ACCEPTED, not absent** | ADR [0131](docs/decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) |
| 2026-08-20 | **PO: DROP Slice 4 item 1** — notification scrubbing **WITHDRAWN as premise-falsified**; the residue class does not exist. Successor `FUP-DOOR-ERASURE-FREETEXT-CENSUS` filed | ADR [0130](docs/decisions/0130-dsr-subject-request-workflow.md) **Amdt 4** |
| 2026-08-20 | **PO: WIDEN `dispose_meeting_minutes`** rather than hedge the copy — the untouched free text joins the redaction set, so `DSR_RESIDUE_NOTICE` line 1 becomes true as written. Discharges `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT`; needs an ADR 0056 §2 amendment | [follow-ups.md](docs/progress/follow-ups.md) |
| 2026-08-20 | **DSR Slice 4 BUILT — QA APPROVED r3.** `referral-dispose-dialog.tsx` renders the shared `DSR_RESIDUE_NOTICE` (closes `FUP-DISPOSE-DIALOG-OVERCLAIM`); meeting door widened; N12/N13/N14 built. ⛔ **Gate steps 4–5 + merge/push still owed** | [review](docs/reviews/dsr-slice-4-review.md) |
| 2026-08-20 | ~~**DSR Slice 4 — QA r1 CHANGES REQUESTED, NOT complete; blocked on the meeting-door widening**~~ — **SUPERSEDED same day**: the widening landed and QA APPROVED at r3 | [review](docs/reviews/dsr-slice-4-review.md) |
| 2026-08-20 | **DSR Slice 3 SHIPPED — QA APPROVED r2, PO-approved.** The ONE named widening (`search_patient_xref` + `is_dpo_of`), adjudication, attested tier, refusal-retirement, ADR 0056 Consequence (a) discharged. ⛔ Zero disposal-gate widenings; **no second read-boundary change** (QA catalog-verified) | ADR [0130](docs/decisions/0130-dsr-subject-request-workflow.md) **Amdt 3** · [review](docs/reviews/dsr-slice-3-review.md) |
| 2026-08-20 | **PO: INVERT the `useFieldIds` `name` default** — the hook omits `name`; `FormData`/radio/autofill callers opt in. The dangerous case was the default, the safe one a discipline at 51 sites (**10/51 measured**). ⛔ Route-crawler gate NOT in scope | FUP-FORM-IDENTIFIER-IN-URL · [follow-ups.md](docs/progress/follow-ups.md) |
| 2026-08-20 | **ADR 0130 Proposed → Accepted; DSR Slice 2 BUILT** (PO instruction). Four shape changes measurement forced — incl. ADR 0056 Consequence (a)'s meetings-dispose UI moving to Slice 3. ✅ **Pilot-gate item 0 DISCHARGED** | ADR [0130](docs/decisions/0130-dsr-subject-request-workflow.md) **Amdt 2** · [plan](docs/plans/dsr-workflow-plan.md) |
| 2026-08-19 | ✅ **Counsel's Q14 return: committee records NOT prontuário; removal requests CASE-BY-CASE with legal consultation (supersedes the blanket override); 20-yr retention adopted BY DEFAULT as policy** (PO-relayed). `subject_request` lane live; refusal copy cites the policy, never CFM 1821 | ADR [0035](docs/decisions/0035-lgpd-anvisa-regulatory-posture.md) **Amdt 1** (resolved) · ADR [0130](docs/decisions/0130-dsr-subject-request-workflow.md) **Amdt 1** |
| 2026-08-19 | **Both § 6b backup residues PROMOTED to § Critical FUP — C3 `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM` (🔴) + C4 `FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED` (🟠)** (PO, explicit instruction). ⭐ C3 shares C1's pilot-data-load trigger for the **opposite** reason; C4 is reachable on Cloud **today** | [run log](docs/deployment/phi-backup-run-log.md) F5/F6 · **§ Critical FUP C3/C4** · [decisions-log](docs/progress/decisions-log.md) |
| 2026-08-19 | ⛔ **"PROGRESS.md is loaded by every spawn" IS FALSE, and never was** — no `@`-import has ever existed. The claim sat in ADR 0124, the banner, the gate header and an external handoff. Always-loaded is CLAUDE.md 32 KB + MEMORY.md 20 KB; this file is read on demand | ADR [0124](docs/decisions/0124-progress-live-state-contract.md) **Amdt 1** |
| 2026-08-20 | **`lint:progress` SIZE_CAP raised 60 KB → 80 KB** (PO instruction) — live file was 207 B under the old cap; project's live surface has outgrown the original sizing | ADR [0124](docs/decisions/0124-progress-live-state-contract.md) **Amdt 2** |

> ↩ **6 concluded/superseded rows dated 2026-08-19 rotated 2026-08-20** (2 superseded the same day they were written; 4 shipped) → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-20 (second headroom pass)", appended verbatim before the cut and `cmp`-verified.

> ↩ **36 rows dated 2026-08-17 → 2026-08-18 rotated 2026-08-20** (the DM5 docket, its eleven DM-FUP triage rulings, and the record-contract decisions — every one concluded) → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-20", appended verbatim before the cut and `cmp`-verified at the destination. ⛔ **The open work those rows reference did NOT rotate** — it lives in § Critical FUP (C1–C4) and § Follow-ups, which this cut did not touch.

> ↩ **23 rows dated 2026-08-05 and older rotated 2026-08-17** → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-17", preserved verbatim before the cut (`cmp`-verified). This table is the **head** of the log, not the log.
| _pre-2026-07_ | **35 earlier decision rows (Phases 0–14, 2026-06-11 → 2026-06-25) rotated 2026-08-04** | [decisions-log.md](docs/progress/decisions-log.md) |

> ↩ **12 rows dated 2026-08-08 → 2026-08-14, and the VERBOSE form of the 32 rows that then stood above, rotated 2026-08-18** → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-18". ⚠ *"Above" went stale on 2026-08-20: those 32 compressed heads are no longer here — they are in § "Rotated from PROGRESS.md 2026-08-20" of the same file, so the verbose and compressed forms now sit in two adjacent sections of the log rather than one here and one there.* ⛔ *The live rows are deliberately one-line — every warning they carried has a body in [follow-ups.md](docs/progress/follow-ups.md); verified before compressing.*

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
| **C1** | 🔒 **`FUP-DM5-DISPOSAL-JOB`** — the PHI-disposal path is **manual and UNREHEARSED**. `disposal_state` records an **intent, not a destruction guarantee**: **4 SET-form writers** put rows into `disposal_pending` — 3 `authenticated`-reachable (`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`) **plus `complete_document_reclassification`, service-role-only** — against **exactly ONE** outflow door, and **nothing automated calls it** (no `pg_cron`, no cron schema, single-process Dockerfile). ⚠ *Corrected 2026-08-18: this said "three inflow doors", which is right only bounded to JWT-reachable doors — **the queue is fed wider than the item said**.* | ⭕ **SPLIT IN TWO 2026-08-18 (DM-FUP TRIAGE #3) — and C1 does NOT close on C1a.** **C1a (local)** — execute [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md) end-to-end against local test data, once, and record the run. ⭕ **PARTIAL 2026-08-19: the § 6b BACKUP half is DONE** — executed, verified, destroyed, recorded in [`phi-backup-run-log.md`](docs/deployment/phi-backup-run-log.md), which discharged `FUP-DM5-BACKUP-IS-PHI-EXPORT`'s destination path. ⛔ **The § 3 DISPOSAL half — which is what C1a is FOR — has still not run.** ⭐ **CORRECTED 2026-08-19:** it was recorded as blocked by `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`; **it never was** — the runbook is the `file_objects`/Storage path and `dispose_meeting_minutes` is disjoint from it in the catalog (writes no `file_objects` row, never sets `disposal_pending`; the runbook says "meeting" zero times). That FUP is resolved anyway (ADR 0129), but § 3 is un-run for its own reasons, not newly released. The two halves are independently executable; do not read the backup run as C1a. **C1b (Cloud)** — the same run against the linked project; ⚠ it **cannot inherit** the backup half, which has no Cloud form at all (`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`). ⛔ **Why the split is not bookkeeping:** the runbook itself says a local rehearsal *"runs against a local stack by construction, so it cannot exercise the Cloud paths"* (§6) — so a local-only run discharges this row's **wording** while leaving its **purpose** undischarged, which is [[a-predicate-quoted-at-the-wrong-grain]] in the highest-severity item in the register. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** PO-accepted 2026-08-18 as a pilot risk **bounded by this rehearsal** (ADR 0121 **Amdt 3**) — the acceptance is not open-ended, and the pilot may not admit real PHI ahead of it. ⭐ **The bound is C1b, not C1a**: the pilot runs on Cloud, so a green local rehearsal does **not** release it. | PO (executor = whoever holds service-role reach — an ACL fact, not a choice) |
| **C2** | 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — **407** reachable command doors sit outside **every** authz arm's domain (`ARM=census` is bounded to `bool`/set-returning; these return `jsonb`/`void`). ⚠ **Covered-but-UNPINNED, not blind** — a 3-door neutralization sample found all three COVERED. ⛔ **The sample may NOT be used to close it.** | **Tier 1 — sweep the subset that touches PHI or crosses a tenant boundary**, derived as a property over the catalog, never hand-listed ([[enumeration-boundary-is-a-syntax-not-a-property]]). **Tier 2 — the remainder is DEFERRED.** Each swept door gets a recorded verdict, so a regression reds and a **new** door cannot pass by absence. ⭕ **Tier 1 ABSORBED TWO ITEMS 2026-08-18** — `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` (successor named: `app.resolve_document_version_bytes`) and `FUP-DM5-SIBLING-GUARD-DIFF`. All three want the same door-mutation machinery over `prosecdef` gates; building it three times was declined. ⚠ **Absorption is not closure** — each keeps its own index line and its own verdict. | **Tier 1: next, as its own scoped workstream** — sizing is step one and is not yet done. **Tier 2: after the pilot ships, once there are real customers.** | lead + backend |
| **C3** | 🔴 **`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`** — § 6b's backup mechanism is `docker exec … tar`, **local-only by construction**. On Cloud: managed backups + PITR **exclude Storage objects by documented design**, *"Restore to a new project"* does not copy them, and `supabase storage cp -r` has **no streaming form** ⇒ **the pilot platform has NO Storage recovery point at all**, and § 6b's *"encrypted AT CREATION"* is **unsatisfiable** there. ⭐ **It INVERTS its parent**: `FUP-DM5-BACKUP-IS-PHI-EXPORT` graded an over-wide copy **existing**; this grades **no copy existing** — opposite failure, opposite remedy, which is why it is a separate item and not absorbed into that close. | **PO decision, two shapes:** (a) accept no Storage recovery point pre-pilot and say so **where the pilot decision is made**, not only here; or (b) **name a mechanism** — ⭐ only one shape can satisfy "encrypted at creation": the **S3 protocol endpoint** streamed into a client-side encryptor (`rclone crypt` and peers), which makes this **the same measurement as `FUP-DM5-CLOUD-ORPHAN-SURFACE`** (that endpoint is **UNPROBED**). ⛔ **Any destination inherits the SOURCE's blindness** — changing the bucket cannot change what the endpoint can enumerate, and a source-count ↔ destination-count check compares **metadata to metadata**. Then rehearse it **restore included**, and prove the restore recreates `storage.objects` rows and not merely bytes. Also owed for any new processor: **BAA posture + LGPD cross-border basis**. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** From the moment the pilot holds data with no recovery point, every day is unrecoverable-loss exposure. ⚠ **Distinct from C1's trigger, and they are easy to conflate:** C1 is about **destroying** bytes on request; this is about **not being able to get them back**. | PO decision, then backend + lead |
| **C4** | 🟠 **`FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED`** — § 6b's five values are scoped **literally** to *"a Storage backup" / "the archive"*, yet the same section requires a `supabase db dump` restored into a **scratch database** to earn the words *"verified good"*. **Neither artifact has a location, reader-set, retention or destruction rule**, and nothing tells the operator to drop the scratch DB — which this same page calls *"a data leak wearing one"* (**90 of 274** RLS policies restored). ⭐ The parent item's own sting one level down, **inside the section that resolved it**. | **PO extends the five values explicitly to both artifacts, OR rules the restore test out of the procedure.** ⚠ The interim mitigation already written into the runbook — apply the values by analogy, **drop the scratch DB as soon as the comparison is recorded**, record both in the run log — is a stopgap and **is not the decision**. | **The first time anyone runs `supabase db dump --linked`** — ⚠ **reachable on Cloud TODAY** (it needs only the DB password, unlike C3), and it is the natural next step of a C1b rehearsal. ⛔ Do not let a C1b run be the first execution of an ungoverned procedure. | PO decision, then backend |

## Follow-ups / Deferred Items

<!-- ONE-LINE INDEX ONLY (severity · id · claim · owner). Full bodies of OPEN items live in
     docs/progress/follow-ups.md; resolved items in follow-ups-archive.md. Compressed
     2026-08-18 at the size rotation — every entry was verified to HAVE a body first. -->
_Full bodies of OPEN items rotated 2026-08-08 → **[follow-ups.md](docs/progress/follow-ups.md)** — update BOTH (the body there, the line here) when an item changes state. Resolved items → [follow-ups-archive.md](docs/progress/follow-ups-archive.md). One line per item: severity · id · title · owner._

⭐ **FOUR items also carry a [§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list) entry** — `FUP-DM5-DISPOSAL-JOB` (C1), `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2), and — **promoted by the PO 2026-08-19** — `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM` (C3) + `FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED` (C4). Their lines below stay put; the Critical entry adds a **trigger and a deadline**, it does not replace the index line.

- 🟠 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ✅ **PO-RULED 2026-08-18 as option (b): supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** — backend
- 🟠 **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — ⭐ **⭐ CRITICAL FUP C2. `ARM=census`'s DEFINER clause is bounded to `bool`/set-returning, so 407 reachable non-trigger command doors (326 RPC-callable) sit outside every arm's domain. ⭕…** — lead + backend
- 🟠 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** — **PARTIALLY RESOLVED 2026-08-17 (`4102149b`); the filed remedy was WITHDRAWN as unbuildable** — lead/backend
- 🟠 **FUP-FORM-IDENTIFIER-IN-URL** — ✅ **4 leaks FIXED + control-proven both directions** (`cpf-field` **CPF**, `user-profile-edit-form`, `affiliations-panel`, `patient-search-view` **MRN/PHI**); 4 more measured NOT-REACHABLE-PRE-HYDRATION. `name` is **INJECTED by `useFieldIds().controlProps`** — ⛔ a `name=` grep cannot find it (beat 3 reasoned reads). ⭐⭐ Both predictions were WRONG in opposite directions: `?password=` doesn't exist; **`cpf` was on no list**. ⛔ **STILL OPEN:** the standing detector must be a **route crawler**, not a re-run of this 8-file list; `<select>` coverage is weaker; and the ✅ **PO-RULED 2026-08-20 inversion of `useFieldIds`' `name` default** (**10/51 measured failure rate**) — assigned to `frontend`, ⛔ **as a SEPARATE change after Slice 3**, and only after enumerating the 4 classes that BREAK without `name` (server-action `FormData`, radio grouping, explicit `FormData` reads, autofill). Credited to `frontend` — frontend/lead
- 🟡 **FUP-E2E-SUBMITTED-POOL-UNSCOPED** — the shared submitted-response pool has no `case_phase_id is null` filter and the one-line fix BREAKS a peer spec — lead/tester
- 🟡 **FUP-PREVIA-MINT-FLAG-ASYMMETRY** — `HC0DV` refuses a prévia on the premise the mint is reachable; the mint’s preconditions are a strict superset — lead
- 🟡 **FUP-LINT-VECTOR-DIMENSION-DRIFT** — a proposed lint gate over shared SQL↔TS vector fixtures (filed, deliberately NOT built) — backend
- ⛔ **The three lines above were ADDED 2026-08-20**: each had a live 🟡 body in [follow-ups.md](docs/progress/follow-ups.md) and **no index line here** — invisible to the register the PO reads from. `lint:progress` checks index→body and **never body→index**, so nothing could contradict it — lead
- ⛔ **`FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument was SWAPPED 2026-08-20** — grep over `src/` → a rendered-output assertion (`referral-dispose-dialog.test.tsx` claim 2, property now shared from [`disposal-copy-property.ts`](src/components/dsr/disposal-copy-property.ts)). The grep's measured record was **0 true positives / 4 false positives** (every match was prose *about* the defect — `FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING`, **closed 2026-08-20 by dissolution**, body in [follow-ups-archive.md](docs/progress/follow-ups-archive.md); its instrument lesson is now `.claude/rules/ui-copy-forbidden-strings.md`); its "nothing, comments included, may contain those strings" prohibition **dissolves with it**. Do not re-run it to re-verify that item — lead
- 🟡 **FUP-VITEST-UNCAPTURED-FAILURE** — a unit test failed once (**1447/1 of 1448**) and **nobody captured which**; passing since is not a diagnosis. ⛔ Filed only because QA found the lead had acknowledged it verbally twice and never recorded it — every trace read a flat "vitest 1447". If it recurs, **capture the output before re-running** — backend/lead
- 🟡 **FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER** — the declaring gate's **own census does not sum** (1165 accounted of 1176 collected — **11 tests in no bucket**), and its INFRA classifier has **no notion of a worker exit code**, so a `0xC0000409` crash is scored as an assertion failure with 5 tests stranded behind it. ⛔ The fix is **not** "add crash to INFRA" — that would hide real defects; a crash is a **third category** requiring a re-run before any verdict — lead/tester
- 🔴 **FUP-E2E-ABSENT-ROW-ASSERTIONS** — `expect(row?.field).not.toBeNull()` **passes when the row is absent**, live on **PHI-erasure** assertions (`pdf-printing-meetings:335`, whose own message is the false statement it makes; `meeting-audio-minutes` ×4 on audio-PHI deletion). ⛔ **Three counts claimed, none survived**: "exactly one other" (tester, relayed by lead), "≥49" (QA, self-flagged unverified), **17 across 10 files + 9 private `serviceQuery` copies** (lead, ⚠ **a lower bound on ONE SHAPE, not the population**). `lint:vacuous` is blind — the vacuity is one call frame away — tester/lead
- 🔴 **FUP-AUTHZ-HARNESS-PRECONDITIONS** — a neutralization verdict rests on **≥2 preconditions** (baseline green · **keystone present in the swept domain**) and the harness asserts **only the first**. ⛔ *"Nothing noticed the gate opening"* and *"nothing that could notice was running"* are **indistinguishable in the output**. Two near-miss **false BLINDs on the same live PHI-adjacent door in one session**, by different broken preconditions; caught by intuition, not by the instrument. A `PASS` with the subject absent must be an **ERROR**. ⚠ **Scope: a RED is sound IFF the baseline was verified green** — a red baseline also yields a red post-probe run, which reads as COVERED (a **false RED, failing in the reassuring direction**). Slice 3's 47 RED + 1 GREEN all clear that bar — backend/harness
- 🟡 **FUP-PGTAP-184-T11-FLAKE** — `184_hospital_admin_isolation.sql` t11 failed once on a full run, passed in isolation + two full runs since. Runs **before** `350`, unrelated to DSR. Not diagnosed — but **named**, so actionable — unassigned
- 🔴 **FUP-PGTAP-VACUOUS** — `lint:vacuous` scans TS specs only; ~6348 pgTAP assertions unscanned, live specimen in a PHI-boundary suite. The sweep must be **proven able to fail** first — lead/backend
- 🔴 **FUP-AFF-1** — the census is BLIND to write-path doors (ADR 0079 Am. 5); ⛔ cite `302`'s keystones, **never `ARM=census`** — backend/harness
- 🔴 **FUP-PCITV-1** — what QA APPROVED **over**, ranked: 5 open (TRUNCATE revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies) — unassigned
- 🔴 **FUP-ETH-ROLES-1** — no production bootstrap of `case_participant_roles`; the bundle lives only in `seed.sql` and `role_id` is NOT NULL, so a real org starts with zero roles and every participant type dead-ends. Decide before a second org onboards — product/backend
- 🔴 **FUP-FF5-1** — patient-lane sublabel degenerate on the READ path (PO DEFERRED; resolve before the lane reaches a real committee) — backend
- 🟠 **FUP-DM5-STORAGE-ORPHANS** — ✅ **Local half CLOSED empty by measurement 2026-08-17** — lead/backend
- 🟠 **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** — **a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with no manifest, no count comparison, no audit — the event ADR 0120 D9 exists to prevent, inside the slice tha** — lead/backend
- 🟠 **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** — **once `…000400` applies, `capture` prints `CAPTURE CLEAN` and the only arm that can still see a surviving byte is the volume `walk`, which is `STORAGE_BACKEND=file` local-only ⇒ on Cloud, pos** — backend
- 🔴 **FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM** — ⭐ **CRITICAL FUP C3 (PO-promoted 2026-08-19).** § 6b's mechanism is `docker exec … tar`, local-only; managed backups **exclude Storage objects by documented design** ⇒ **the pilot platform has NO Storage recovery point at all**. ⭐ It **inverts** its parent: an *absent* backup, not an over-wide one — PO/backend/lead
- 🟠 **FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED** — ⭐ **CRITICAL FUP C4 (PO-promoted 2026-08-19).** § 6b's five values are scoped to *"the archive"*, yet the same section mandates a `db dump` + **scratch database** to earn *"verified good"* — neither governed, and nothing says to drop the scratch DB. ⚠ **Reachable on Cloud today** — PO/backend
- 🟠 **FUP-DM5-DISPOSAL-JOB** — ⭐ **CRITICAL FUP C1, split into C1a (local) + C1b (Cloud) on 2026-08-18; the pilot bound is C1b.**
- 🟡 **FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING** — ADR [0131](docs/decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) makes `DSR_RESIDUE_NOTICE` line 1 (*"o descarte apaga os dados do paciente armazenados no banco"*) **conditionally** true rather than structurally true: it holds **provided PHI was entered only in PHI fields**, which is a **training** control the software cannot enforce. ⛔ **Not falsified — its premise is newly explicit.** PO copy call: scope the sentence to the designated fields, or accept it as-is on the training premise. ⚠ Whichever way, ADR 0131's risk acceptance must ALSO be recorded **where the pilot decision is made**, not only in the ADR (the same requirement C3 carries) — PO/frontend
- 🟠 **FUP-DISPOSE-EVENT-DOOR-GATE-BLIND** — ⚠ **NOT descoped by ADR 0131** — this is the door's authorization **gate**, not its reach; "perfect execution of confirmed PHI columns" makes it *more* load-bearing. Keystone written (`352_dispose_event_door_gate.sql`, 6 tests, mutation-proven RED with the gate opened and GREEN restored, hash-verified both ways); ⛔ **not yet run inside the full suite on a fresh reset**. `dispose_event_phi`'s authz gate is exercised by **no keystone**: opened alone, the full suite still **PASSES** (6550/6550). Measured 2026-08-19 by neutralization during the ADR 0129 sweep, which also cleared its three siblings — `dispose_case_phi` ✅ (151, 314), `dispose_referral_phi` ✅ (189), `dispose_meeting_minutes` ⛔→✅ (now `348` t7). So **2 of 4** PHI-disposal doors were door-blind; one is closed, this one is not. ⚠ **BLIND ≠ vulnerable** — the gate is present and correct; nothing would go red if a refactor dropped it. `ARM=floor` cannot see this (the door **is** called; its *gate* is not exercised) — backend
- 🟠 **FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES** — PHI leaves by **two** substrates and only one has a procedure. [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md) is the **`file_objects`/Storage-bytes** mechanism; the four **column-erasing** doors (`dispose_meeting_minutes`, `dispose_case_phi`, `dispose_event_phi`, `dispose_referral_phi`) have **no operational procedure at all**. Measured: the runbook says `meeting` / `minutes_md` / `dispose_meeting_minutes` / `dispose_event_phi` / `PHI removido` **zero** times, and names the other two doors only as *inflow* that parks a `file_objects` row. ⚠ Not a claim that column PHI is un-erasable — those doors complete synchronously, which is why they never got a procedure. The risk is that **a C1a green is read as covering PHI disposal**. Needs: the runbook to state its substrate, plus either a companion procedure or a recorded "none needed" with the evidence path named. Found 2026-08-19 by correcting a wrong-grain claim — PO + backend
- 🟡 **FUP-XREF-PEPPER-ROTATION-ORPHANS** — rotating `mrn_pepper` permanently orphans DISPOSED `patient_xref` rows (raw MRN gone, key unrecomputable); ADR 0039 logged it as "follow-up", never registered. Every granted erasure widens the unrotatable population. Decide before any rotation task is scoped — backend
- 🔵 **FUP-ADR0121-REASON-VALUE-DRIFT** — ADR 0121 Amdt 2 deliberately left the `superseded`-vs-`retention_expired` reason value OPEN; the D11 register body already states `'superseded'` as if chosen (live CHECK still admits only the original five). The D11 implementing slice decides explicitly + records in the ADR's reserved slot; neither value citable as decided until then — lead
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

_**FUP-DM5-NO-ANSWER-VS-NOTHING** (🔴, the class) rotated 2026-08-19 → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) § "Index line rotated from PROGRESS.md 2026-08-19" — all six instances closed; last one (`--allow-orphans`) fixed by ADR [0128](docs/decisions/0128-unproven-is-not-clean-capture-outcome-classes.md). Body stays in [follow-ups.md](docs/progress/follow-ups.md); ⭐ the one-sentence class statement is deliberately KEPT there as a review lens, not archived away._

_**FUP-DM5-BACKUP-IS-PHI-EXPORT** (🔴) rotated 2026-08-19 → the same archive section — ✅ **RESOLVED by execution**, not by decision: both remaining deliverables (destination path, first run) discharged against the local stack; record [phi-backup-run-log.md](docs/deployment/phi-backup-run-log.md). Body stays in [follow-ups.md](docs/progress/follow-ups.md). ⛔ **Its two residues are the NEW 🔴/🟠 lines above — the close is bounded, not total.**_

_Parked / deferred backlog — full detail (owner, rationale, repro) relocated to **[deferred-backlog.md](docs/progress/deferred-backlog.md)** to keep this tracker scannable; titles + pointers kept live below._

- 📦 **Parked backlog — 27 items**, index and full detail (owner, rationale, repro) → [deferred-backlog.md](docs/progress/deferred-backlog.md)


