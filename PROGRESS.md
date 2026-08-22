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

- **✅ CASE SURFACE SPLIT · INCREMENT 1 — COMPLETE, MERGED to `main` 2026-08-21** (ADR 0134 D1–D5, D7
  + Step 0; §6 steps 1–5, QA APPROVED r3, PO-approved). Bullet rotated verbatim 2026-08-22 →
  [case-surface-split-increment-1.md](docs/progress/case-surface-split-increment-1.md), which also holds
  its narrative. ⚠ **Two things it carried that are still live:** the PO's approval covered **Increment 1
  + that merge only** — not Increment 2, not any remote push; and **D1's ratified sentence was observably
  false on `main` the day it shipped**, repaired by ADR 0134 **Amendment 3** (capability-invariance), which
  is the wording Increment 2 is judged against.
- **✅ RULED 2026-08-22 — ADR 0134 Amendment 4: S8 is bounded by `not v_eg`, like S5/S7** — an
  `explicit_grants_only` case is invisible to the `read_cases` arm. ✅ **Its binding work has LANDED**
  (the bound, P9/P9-twin/P10/P11, and the door-set enumeration now **pinned** in `356` §13, not merely
  recorded). Bullet rotated verbatim → [case-surface-split-increment-2.md](docs/progress/case-surface-split-increment-2.md).
  ✅ `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY` is **RESOLVED** — the merge condition this line named is
  satisfied (`be546bbf`, on `main`), so the item rotated → [follow-ups-archive.md](docs/progress/follow-ups-archive.md).
- **📋 PLANNED 2026-08-20 — workstream AFF2 (affiliation-scoped administration +
  user-management redesign): ADR accepted, build NOT started.** Hospital admins gain
  person-level + lifecycle authority over sole-footprint people; CPF-mandatory 3-step
  register wizard (escape hatch removed); the three UM screens rebuilt to the design
  handoff. ADR [0133](docs/decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md)
  (renumbered from 0129 at the 2026-08-21 reconciliation — main's DSR track had taken
  0129) **+ Amdt 1** (2026-08-21 — capability-split widening, § Decisions) · plan
  [aff2-user-management.md](docs/plans/aff2-user-management.md). **Start
  condition: the prévia merge call is SATISFIED (`9ed197d5`, merged + pushed); what
  remains is the PO's merge call on `chore/small-optimizations` itself + explicit build go.**
- **A phase IS active** — case surface split **Increment 2**, above. Everything else that stood here
  is done: the **DM program (DM0–DM5)** closed 2026-08-18 (QA APPROVED r2), the **DSR** program closed
  2026-08-20 and its **operational remediation** 2026-08-21 (both merged **and pushed**), and the Cloud
  constructed-orphan probe concluded 2026-08-18. All five bullets rotated **verbatim** 2026-08-22 →
  [now-concluded-2026-08.md](docs/progress/now-concluded-2026-08.md), which is also where the
  `Imprimir prévia` / `Emitir documento` split already sat. ⛔ **Their open residue did NOT rotate** —
  every follow-up and bug those bullets named was verified by name to hold its own line in
  § Follow-ups / § Bug Log first. ⛔ **Two things there must not be read as closure:** `e2e:prod` was
  **never re-run** for the DSR final increment (last full run was the S3 gate), and the ethics lane is
  *non-erasable by decision with two known open removal paths* — a worse state than "no path exists".
- **▶ Next, in order** (PO-sequenced 2026-08-18; **the 0125/0126 build that jumped this queue
  has SHIPPED**, so these resume their order):
  1. **C1a** — local end-to-end run of
     [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md).
     ⛔ **STILL UN-RUN, and nothing about it changed on 2026-08-19.**
     ⭐ Its 2026-08-19 correction — a real defect had been cited as blocking C1a and did **not** bound it — rotated 2026-08-22 → [now-concluded-2026-08.md](docs/progress/now-concluded-2026-08.md). ⚠ The error ran in the **reassuring** direction: it made C1a read as blocked-then-released rather than simply never started.
     ⚠ Whoever runs C1a: the fixture caveat belongs to **meeting** disposal, which this runbook does
     not cover at all — see 🟠 `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`.
  2. **C2 Tier 1 sizing** (absorbs `Q1-OPEN-BYTES-CUT` + `SIBLING-GUARD-DIFF`).
  3. **`FUP-DM4-PRODROW`** — now actionable: re-derive a magnitude, or rule that it
     cannot be (TRIAGE #9 already forbids closing it as "reconciled").
- ⛔ **Re-measure `schema_migrations` and `auth.users` — never re-read a recorded figure** (stale **5×**, incl. a "HEAD is behind" claim that was false when written). The 2026-08-18 migration-hold resolution rotated 2026-08-22 → [now-concluded-2026-08.md](docs/progress/now-concluded-2026-08.md).
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
- **✅ SHIPPED 2026-08-19 — the documentation-stability refactor** (ADR [0127](docs/decisions/0127-standing-rules-home-and-staleness-gate.md); ADR [0124](docs/decisions/0124-progress-live-state-contract.md) Amdt 1): standing rules moved to `.claude/rules/`, `lint:rules` is gate 8, and rules were **measured to fire**. Bullet rotated verbatim 2026-08-21 → [now-concluded-2026-08.md](docs/progress/now-concluded-2026-08.md), which keeps the four filed-not-built items and the ⛔ premise-was-false note.
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

✅ **BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW — RESOLVED 2026-08-21**, fixed / mutation-proven / gated /
merged (`96c49da4`) / applied to the linked project. Full row + closure narrative rotated verbatim →
[bug-log-archive.md](docs/progress/bug-log-archive.md). ⛔ **It sat here wearing a 🔴 for hours after it was
fixed** — `lint:progress` reds a resolved *follow-up index line* but **cannot see a fixed bug left in the OPEN
section**, so rotation discipline is the only control, and it is the one this repo records as chronically
skipped. Caught while writing a report **from this register**, which is the register's real test.

✅ **BUG-QO-STALE-CASOS + BUG-QO-STALE-CASOS-2 — BOTH RESOLVED 2026-08-21** (Step 0 of the case-surface-split
program, branch `feat/case-surface-split`, commit `4ec53577`). `quality-oversight.spec.ts` **21 p / 0 f /
0 did-not-run / exit 0** on a fresh reset, was 19p/2f. The pairing was preserved, not swapped. Full rows +
closure narrative rotated verbatim → [bug-log-archive.md](docs/progress/bug-log-archive.md).
⭐ Carried forward because it outlives the bug: **"two failing tests" was a FLOOR, not a count** — a failing
assertion masks every assertion after it in the same test, so instance 3 was invisible until instance 1 was
fixed. Sweep the class **statically**; a run-fix-rerun loop reports green at the last **reachable** stale
assertion. ✅ **The repair is now ON `main`** — `feat/case-surface-split` merged at `6e364203`, so the
condition this line named is satisfied and the baseline expectation is **0 known-stale failures**.
⚠ **Expectation, not a measurement:** no full clean `e2e:prod` has confirmed it — the most recent gate row is
the Increment-2 **union of two runs with 75 unrun**, and that row does not record which batches those were,
so whether `quality-oversight.spec.ts` executed post-merge is **undetermined, not green**. Re-derive from a
run before quoting it as the baseline.

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
| 2026-08-22 | ⭐ **CASE SPLIT · Inc 2 — §6 steps 1–2 at `794bd971`** | `test:db` **208f/6941t** · lint 8/8 · `tsc` · vitest **1555** · 4 ARMs exit 0 ⛔ **all VACUOUS** · `e2e:prod` **1090p / 0 FAILED / 75 unrun → RED(UNRUN)**; the 2 named batches re-ran **129/129 GREEN**. ⚠ **UNION of 2 runs** — [caveats](docs/progress/case-surface-split-increment-2.md) |
| 2026-08-21 | ⭐ **CASE SPLIT · Inc 1 — §6 steps 1+2 CLEAN at `e7ec7529`** | **GATE GREEN exit 0** — 1176 p / 0 f / 4 flaky / 11 skip / **did-not-run 0** / 1191; census sums. pgTAP **6795** F=206 · lint(8) **0** · `tsc` **0** · vitest **1506** · 4 ARMs **HOLD** — all re-measured on THIS tree. ⚠ 4 infra re-runs (was 2) → [archive](docs/progress/test-run-archive.md) |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **Case split · Inc 2** (ADR 0134 D6 + Amdt 1–7) | ✅ **APPROVED (r2)** — 5 record conditions, none blocking merge, **all 5 discharged 2026-08-22** (C-1/C-4 here · C-2/C-3 → [increment record](docs/progress/case-surface-split-increment-2.md) · C-5 → `FUP-CS2-QA-RESIDUE`); r1 CHANGES REQUESTED (5 blocking, incl. a PHI write handed to `platform_admin`) | 2026-08-22 | [review](docs/reviews/case-surface-split-increment-2-review.md) |
| **Case surface split · Increment 1** (ADR 0134 D1–D5, D7) | ✅ **APPROVED** (r3) — 4 conditions, all for the Record edit (§8.9). No security defect in any round | 2026-08-21 | [case-surface-split-increment-1-review.md](docs/reviews/case-surface-split-increment-1-review.md) |
| ~~Case surface split · Increment 1 (r2)~~ | ~~CHANGES REQUESTED~~ | 2026-08-21 | [case-surface-split-increment-1-review](docs/reviews/case-surface-split-increment-1-review.md) |
| ~~Case surface split · Increment 1 (r1)~~ | ~~CHANGES REQUESTED~~ | 2026-08-21 | [case-surface-split-increment-1-review](docs/reviews/case-surface-split-increment-1-review.md) |
| **DSR operational remediation** | ✅ **APPROVED** (r2; r1 CHANGES REQUESTED — 3 blockers, all records, no engineering) | 2026-08-21 | [dsr-remediation-review.md](docs/reviews/dsr-remediation-review.md) |
| DSR operational remediation (r2) | **APPROVED** | 2026-08-21 | [dsr-remediation-review](docs/reviews/dsr-remediation-review.md) |
| ~~DSR operational remediation (r1)~~ | ~~CHANGES REQUESTED~~ | 2026-08-21 | [dsr-remediation-review](docs/reviews/dsr-remediation-review.md) |
| _The seven DM rows_ — rotated 2026-08-19, the DM milestone being closed | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| _Verbose form of the 5 rows above, incl. both struck r1 rounds_ — rotated 2026-08-14 (§5: never restate rationale here) | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| 117 concluded rows | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-22 | **PO: bulk creation needs TWO existing keys** (`create_cases` ∧ `assign_case_phases`); `all_phases` stays coordinator-only and is refused **at the gate**, not after 200 rows. A1.2's one-arm sentence was built and measured insufficient — `bulk_create_cases` is a **composition** | ADR 0134 **Amdt 7** |
| 2026-08-22 | **LEAD: `member_can_for` is the single predicate implementation, `member_can` delegates.** D6 named a chokepoint that takes **no uid** and so cannot answer S8's question | ADR 0134 **Amdt 6** |
| 2026-08-22 | **PO: "default-checked" is a GRANT, not a pre-ticked box** — `appoint_administrativo` grants `read_cases` on a **new** appointment; existing appointees are **not** backfilled | ADR 0134 **Amdt 5** |
| 2026-08-21 | **PO: OPEN-4 = option D — creation-scoped PHI write for `create_cases`** — the platform's **first PHI write path not held by a coordinator**: type identifiers **while creating** a case, never read or edit after. ⛔ Narrowed at build (lead): server returns **no identifier value** | ADR 0134 **Amdt 2** |
| 2026-08-21 | **PO: OPEN-1 — NO BACKFILL.** Existing administrativo appointees do not receive `read_cases`; the coordinator opts in per appointee, so every grant has a coordinator action behind it | ADR 0134 **Amdt 1 §A1.1** |
| 2026-08-22 | **PO: D1 AMENDED — `/casos`'s invariant is capability-invariance, not absence of writes.** An affordance may sit there if name-attributed **or if its door admits every member who can open the page**; admission earned at the door, from the catalog. ⛔ *"Carve-outs go to zero"* was false on `main` | ADR [0134](docs/decisions/0134-case-surface-split-and-administrativo-case-read.md) **Amdt 3** |
| 2026-08-22 | **PO: S8 bounded by `not v_eg`, like S5/S7** — an `explicit_grants_only` case is invisible to the `read_cases` arm; reach rides an S3 grant or nothing. ⛔ Unbounded it left the appointee in the quality reviewer's exact bit-shape. Binds M2: P9 · P9-twin · P10 · P11 + door census | ADR [0134](docs/decisions/0134-case-surface-split-and-administrativo-case-read.md) **Amdt 4** |
| 2026-08-21 | **PO: case split = read vs manage** — `/casos` = read + name-attributed work only; ONE manage surface (coordinator / administrativo / write-grantee); administrativo gets commission-wide case READ (5th cap `read_cases`). ⛔ NOT built — plan: [case-surface-split.md](docs/plans/case-surface-split.md) | ADR [0134](docs/decisions/0134-case-surface-split-and-administrativo-case-read.md) |
| 2026-08-21 | **PO: an ethics proceeding carries NO erasure entitlement, at any stage — no door, no UI.** Basis is the record's **administrative-proceeding** nature, ⛔ **not CFM 1821/2007**. Closes the Class-2 question. ⛔ **2 pre-existing doors DO remove ethics data** — filed, record-only | ADR [0132](docs/decisions/0132-ethics-proceedings-carry-no-erasure-entitlement.md) |
| 2026-08-21 | **AFF2 Amdt 1 (PO): footprint bound SPLITS by capability** — fields+credentials → **intersection**, CPF-change+lifecycle keep **subset** · silent cross-hospital write **ACCEPTED residual** · LGPD: professional titulares administrative, **out of DSR scope BY DESIGN** · 6 rulings | ADR [0133](docs/decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md) **Amdt 1** |
| 2026-08-20 | **AFF2 accepted (PO): affiliation-scoped hospital_admin authority** — footprint-bounded person-level edits, credentials + lifecycle · CPF mandatory in UI, escape hatch REMOVED · `date_of_birth`+`phone` added column-locked · credentials SELECT widens · presence-only CPF display | ADR [0133](docs/decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md) (né 0129) · amends 0097 D11/D14 · 0098 W3.2 · [0048](docs/decisions/0048-user-registration-identity.md) D10 |
| 2026-08-20 | **PO: DSR gate CLOSED — approval given, program merged + pushed.** §6 steps 1–5 complete; step 1 re-run on a fresh reset. ⛔ Step 2 (`e2e:prod`) **not re-run** for the final increment — recorded, not implied | [dsr-program.md](docs/progress/dsr-program.md) |
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
| ⛔ **CORRECTED 2026-08-21 — the remote holds the E2E SEED FIXTURE, not nothing.** This row said *"it holds no data and no users"* (census 2026-08-18). **Measured 2026-08-21 against the linked project: `auth.users` = 36, all `@test.local`, created 2026-08-19 — i.e. AFTER that census; 0 non-test accounts; 1 pre-promoted `platform_admin`; `cases` 10, `responses` 17; synthetic PHI `patient_identifiers` 2 / `event_patient` 3 / `referral_patient` 3.** ⭐ **No real customer data** — so the *conclusion* (safe to touch) survives; the *premise* did not, and the premise is what other decisions were resting on. ⚠ This is the **fifth** time a claim about the remote has gone stale in this file. ⛔ **Re-measure `auth.users` and `schema_migrations` before citing this row — never quote it.** | **expires at pilot data-load**, when it must be REPLACED by the rehearsed C1b disposal bound (§ Critical FUP C1), never just deleted |
| ✅ **The remote is CURRENT as of 2026-08-21: 435 applied, head `20261003000300`** — 14 migrations pushed (ADR 0129 child-lock work + DSR Slices 2–4 + this round's four), PO-authorised. `dsr` flag **enabled**, and the disposal invariant re-derived **on the remote**: 3 setters / 5 readers. ⚠ A `git push` is not a `db push`; both were done, separately and deliberately | superseded by the next remote-affecting change — **re-measure, do not quote** |


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

- 🔴 **FUP-ETHICS-CASE-DELETE-CASCADE** — a commission `staff_admin` can `DELETE /rest/v1/cases` an **in-flight** ethics case, cascading all **7** `ethics_*` tables; the lane's deliberate SELECT-only lockdown (9 tables, 14 DEFINER writers, **no DELETE in any**) is defeated by a parent that was never locked down — same JWT gets **403** on `ethics_case_details`, **200** on `cases`. `guard_case_status` bars DELETE only for `completed`/`cancelled`. ⛔ **3** audit rows emitted, **0** naming any ethics entity (no `ethics_*` table has an audit trigger). Confirmed by execution, rolled back. **PO-ruled RECORD-ONLY 2026-08-21** — accepted and OPEN — backend/PO
- 🟠 **FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE** — `redact_professional_profile` erases the accused doctor from an **undecided** ethics case: the `HC0J7` bar needs an `issued` decision and `trg_pin_respondent_retention` fires only on the transition **into** `issued`, so both halves are false all through intake/findings/hearings. Executed by a plain commission `staff_admin`. ⚠ **No UI calls it — that is not the control**; the RPC is `EXECUTE`-granted to `authenticated` and answers over PostgREST. Existing pgTAP `257` + E2E pin only the **pinned** case, so nothing is red. **PO-ruled RECORD-ONLY 2026-08-21** — backend/PO
- 🟠 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ✅ **PO-RULED 2026-08-18 as option (b): supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** — backend
- 🟠 **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — ⭐ **⭐ CRITICAL FUP C2. `ARM=census`'s DEFINER clause is bounded to `bool`/set-returning, so 407 reachable non-trigger command doors (326 RPC-callable) sit outside every arm's domain. ⭕…** — lead + backend
- 🟠 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** — **PARTIALLY RESOLVED 2026-08-17 (`4102149b`); the filed remedy was WITHDRAWN as unbuildable** — lead/backend
- 🟠 **FUP-FORM-IDENTIFIER-IN-URL** — ✅ **4 leaks FIXED + control-proven both directions** (`cpf-field` **CPF**, `user-profile-edit-form`, `affiliations-panel`, `patient-search-view` **MRN/PHI**); 4 more measured NOT-REACHABLE-PRE-HYDRATION. `name` is **INJECTED by `useFieldIds().controlProps`** — ⛔ a `name=` grep cannot find it (beat 3 reasoned reads). ⭐⭐ Both predictions were WRONG in opposite directions: `?password=` doesn't exist; **`cpf` was on no list**. ⛔ **STILL OPEN:** the standing detector must be a **route crawler**, not a re-run of this 8-file list; `<select>` coverage is weaker; and the ✅ **PO-RULED 2026-08-20 inversion of `useFieldIds`' `name` default** (**10/51 measured failure rate**) — assigned to `frontend`, ⛔ **as a SEPARATE change after Slice 3**, and only after enumerating the 4 classes that BREAK without `name` (server-action `FormData`, radio grouping, explicit `FormData` reads, autofill). Credited to `frontend` — frontend/lead
- 🟡 **FUP-E2E-SUBMITTED-POOL-UNSCOPED** — the shared submitted-response pool has no `case_phase_id is null` filter and the one-line fix BREAKS a peer spec — lead/tester
- 🟡 **FUP-PREVIA-MINT-FLAG-ASYMMETRY** — `HC0DV` refuses a prévia on the premise the mint is reachable; the mint’s preconditions are a strict superset — lead
- 🟡 **FUP-TITLE-ERASURE-REACH-IS-NOT-UNIFORM** — six of the ten annotated `*.title` columns ARE inside a `dispose_*` door's reach and four are NOT, so the loose reading of ADR 0131 Amdt 1's "title invariant" (*titles are outside erasure*) is false for six of them. ⛔ The helper-text constants therefore give **visibility**, never erasure, as the reason — pinned by assertion. Open: whether the ADR names the split — PO/lead
- 🟡 **FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM** — **a pipe erases the exit status of everything left of it, and NO gate here can catch it.** Measured failure rate **2 occurrences in one day**, both by an operator who knew the narrow form: `gate | tail && commit` landed **a commit on a FAILING gate**, and `cmd; echo "EXIT=$?"` reported a gate that exited **1** as green. ⛔ **Filed as an ACCEPTED RESIDUAL, not resolved** — `pipefail` cannot reach an ad-hoc command, a script cannot detect being piped, no gate can verify an exit code never captured, and a `.claude/rules/` entry fails ADR 0127 admission (POSIX semantics **cannot be shown stale**; an admissible variant would fire on *file edits* and both occurrences touched no file — **admissible and inert**). The control is a habit; recorded plainly, in the same register as the ADR 0131 training premise — lead
- 🟡 **FUP-RULES-VOLUME-CAPS-BIND-IN-OPPOSITE-DIRECTIONS** — ADR 0127’s two volume caps bind DIFFERENT rules in opposite directions (measured 2026-08-21: the 2 rules with ~no byte headroom (92 B / 68 B of 2048) are the 2 nobody would call broad; the one that IS broad matches **125** files against a soft cap of 40 and has it waived by `broad:`, leaving bytes as its only live bound). ⛔ The gate’s success line reports NEITHER headroom, so proximity is invisible until an edit reds it — a 1-line path add left **31 bytes** and still printed `OK`. Fix shape: report the TIGHTER headroom per rule; ⛔ filed, NOT built — a gate change needs its own decision — lead
- 🟡 **FUP-LINT-VECTOR-DIMENSION-DRIFT** — a proposed lint gate over shared SQL↔TS vector fixtures (filed, deliberately NOT built) — backend
- ⛔ **The three lines above were ADDED 2026-08-20**: each had a live 🟡 body in [follow-ups.md](docs/progress/follow-ups.md) and **no index line here** — invisible to the register the PO reads from. `lint:progress` checks index→body and **never body→index**, so nothing could contradict it — lead
- ⛔ **`FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument was SWAPPED 2026-08-20** — grep over `src/` → a rendered-output assertion (`referral-dispose-dialog.test.tsx` claim 2, property now shared from [`disposal-copy-property.ts`](src/components/dsr/disposal-copy-property.ts)). The grep's measured record was **0 true positives / 4 false positives** (every match was prose *about* the defect — `FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING`, **closed 2026-08-20 by dissolution**, body in [follow-ups-archive.md](docs/progress/follow-ups-archive.md); its instrument lesson is now `.claude/rules/ui-copy-forbidden-strings.md`); its "nothing, comments included, may contain those strings" prohibition **dissolves with it**. Do not re-run it to re-verify that item — lead
- 🟡 **FUP-VITEST-UNCAPTURED-FAILURE** — a unit test failed once (**1447/1 of 1448**) and **nobody captured which**; passing since is not a diagnosis. ⛔ Filed only because QA found the lead had acknowledged it verbally twice and never recorded it — every trace read a flat "vitest 1447". If it recurs, **capture the output before re-running** — backend/lead
- 🟡 **FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER** — ⭕ **ARITHMETIC HALF RESOLVED 2026-08-21 by measurement: the census DOES sum.** A full 19/19 run gave `1166 p · 2 f · 3 flaky · 11 skipped` = **1182 collected, exactly**, while the gate printed `accounted for 1171` — because `accounted` **omits the skipped bucket**. ⭐ The *"11 tests in no bucket"* were always skips; the defect is the reporting definition, not lost tests. ⚠ **STAYS OPEN for the other half**: the INFRA classifier still has no notion of a worker exit code, so a crash scores as an assertion failure — ⛔ and the fix is still not "add crash to INFRA", a crash is a third category needing a re-run before any verdict. ⭐ `did-not-run` was **0 on all 19 batches** — that field, not the pass count, is what answers "was anything swallowed?" — lead/tester
- 🔴 **FUP-E2E-ABSENT-ROW-ASSERTIONS** — `expect(row?.field).not.toBeNull()` **passes when the row is absent**, live on **PHI-erasure** assertions (`pdf-printing-meetings:335`, whose own message is the false statement it makes; `case-patient:1193`). ⭐ **FOURTH CORRECTION 2026-08-20 (measured, vitest): the defect is the MATCHER, not the optional chaining** — `.not.toBeNull()` passes on `undefined`; `.toBeTruthy()`/`.toBe(false)`/`.toBeNull()` all throw. So the `meeting-audio-minutes` ×4 previously listed here are **SOUND**, and the population must be re-derived as *matcher ∈ accepts-`undefined`* × possibly-absent subject, ⛔ never as a grep for `?.`. ⚠ The item does **not** shrink: the second mechanism (a helper returning `[]` on a FAILED READ) is matcher-independent and still unswept. ⛔ **Three counts claimed, none survived**: "exactly one other" (tester, relayed by lead), "≥49" (QA, self-flagged unverified), **17 across 10 files + 9 private `serviceQuery` copies** (lead, ⚠ **a lower bound on ONE SHAPE, not the population**). `lint:vacuous` is blind — the vacuity is one call frame away — tester/lead
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
- 🟠 **FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED** — ✅ **ALL SEVEN LANES MEASURED 2026-08-20** (catalog + a **59-probe executed differential**; 7 positive controls + a THAW control; ⚠ 2 probes were re-run after matching their expectation **for the wrong reason** — a gate refusal masquerading as a state refusal; rolled back, pre-state re-verified). **(a)** Only **rca** is fully covered; the other six each have a structurally terminal state no door reverses (`distributed`/`cancelled` · `cancelled` · `cancelled` · `cancelled` · `closed`+`cancelled`) — and the **referral corridor never restores the SOURCE's own free text at all** (draft-only), it reopens the reply. **(b)** Of the six lanes the item said must not be generalised, only **two** repeat the meeting's "narrower": one **EQUAL**, one **WIDER**, one **CROSSING**, one **DISJOINT** — wrong in BOTH directions, as warned. ⛔ **And the erasure fallback this item assumed is BROKEN**: `dispose_event_phi` raises on a `completed` RCA or a `completed`/`cancelled` CAPA, `dispose_case_phi` on a `completed`/`cancelled` interview — ADR 0129's defect in three siblings its fix never looked at (`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`). Residue: PO ruling per frozen state; manual-source capa has NO erasure door; 2 guard messages point at an unreachable corridor — backend/PO
- 🟠 **FUP-E2E-HELPERS-SWALLOW-FAILED-READS** — the **matcher-independent** half of `FUP-E2E-ABSENT-ROW-ASSERTIONS`: a helper returning `[]` on a **failed read** makes *"the request errored"* and *"the table is empty"* indistinguishable. **3 fixed 2026-08-21** (two local `restGet`s + the **shared** `serviceQuery` used by 6 specs, 47/47 re-run green, safe because every call site uses the service role). ⛔ Population is **~48 spec files + 2 helpers** carrying the same `Array.isArray(data) ? data : []` shape, deliberately **not** swept — ⭐ *a fix count is not a population count*. ⚠ Where a helper is used with an RLS-scoped key, `ok()` is the **wrong** assertion, which is what makes this per-helper rather than a codemod — tester/lead
- 🟡 **FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE** — `dispose_case`/`dispose_event`/`dispose_meeting` all gained inbox-driven browser coverage this round; **`dispose_referral_phi`'s live pathway has no browser test anywhere** (the only `e2e/` hit is a direct RPC POST, which proves the door and says nothing about the card, the confirm flow or the server action). ⚠ The named residual of `BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE`, which closed **on removal of its subject, not on achieved coverage** — so the lane whose UI was deleted is the lane with the least coverage, and that close is the document a future reader finds first — tester
- 🟡 **FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE** — the browser-level P0 guard (`dsr-disposal-child-lock-regression.spec.ts`) drives a **locked interview** and asserts by count: that is item **9 of the P0's ten** statements. ⛔ The **`meeting_cases`** lane (item 10) and the **RCA/CAPA** lanes have no browser coverage; both are pgTAP-`353`-covered and mutation-proven, so this is a **layer** gap, not an unproven fix. ⭐ Filed by the guard's own author in the report delivering it — the alternative is a green spec whose name implies it covers the bug — tester
- 🟠 **FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET** — `disposal-copy-property.ts` is iterated by two suites and **nothing asserts which surfaces exist or how many import it**. Removing one surface (the PO-ruled `ReferralDisposeDialog` deletion) would have dropped **three** coverage items, **two silently**: the residue-CLASS content pin **1 → 0** (eight other assertions pin the notice's *length*, none its *content* — a cardinality pin and a content pin are different properties and the cheaper one gets written) and the type-to-confirm arming pin **1 → 0** on a **live** control, leaving the module's most dangerous button with zero behavioural coverage. ⛔ `lint:vacuous` is structurally blind — the assertions were **removed**, not made vacuous. Caught only by reading all 15 tests before deleting any; the fix shape is a declared surface roster with a floor, as the over-claim suite already has — lead/frontend
- 🟠 **FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY** — ADR 0130 D1 owes the data subject a written answer with its legal basis (Art. 18 §4), and `dsr-outcome-record.tsx` **renders on screen only**: measured 2026-08-20, the DSR module has **no export, print, PDF or download path anywhere**, and no document says how the record reaches the subject. ⛔ **PO-DEFERRED 2026-08-20 with the gap named — not closed, not descoped.** Two shapes when taken up (minimal print vs registered emission under ADR 0125/0126); ⛔ do not let the screen render stand in for delivery in any status claim — PO/frontend
- 🟡 **FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER** — `app.is_dpo_of_for` requires a commission role in the hospital as a **hard conjunct**, and `organizations_select` has no DPO arm, so a pure LGPD data-protection officer **cannot reach `/o/[org]/titulares` at all**. ⛔ **BY DESIGN** (ADR 0130 D2, *"a plain member of ONE commission BY DESIGN"*) — filed as the product question it is: onboarding a real compliance officer today means granting a commission membership they do not need, which is a read grant over that commission's content. ⭐ Found 2026-08-20 when `frontend` measured a lead spawn premise false **before** building dead nav code against it — PO/product
- 🟡 **FUP-XREF-PEPPER-ROTATION-ORPHANS** — rotating `mrn_pepper` permanently orphans DISPOSED `patient_xref` rows (raw MRN gone, key unrecomputable); ADR 0039 logged it as "follow-up", never registered. Every granted erasure widens the unrotatable population. Decide before any rotation task is scoped — backend
- 🔵 **FUP-ADR0121-REASON-VALUE-DRIFT** — ADR 0121 Amdt 2 deliberately left the `superseded`-vs-`retention_expired` reason value OPEN; the D11 register body already states `'superseded'` as if chosen (live CHECK still admits only the original five). The D11 implementing slice decides explicitly + records in the ADR's reserved slot; neither value citable as decided until then — lead
- 🔵 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — **⚠ HALF RESOLVED 2026-08-17 (`24cee179`): the fail-open half is fixed and proven; the arm is still a no-op pending a NAMED successor (deliberately not re-pointed — a successor must be named,…** — backend
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — ✅ **DECIDED 2026-08-18: BUILD IT, at retention expiry** — backend
- 🟠 **FUP-DM5-SIBLING-GUARD-DIFF** — **no authz arm can see a door that OMITS a check its siblings all make** — lead/backend
- 📦 **Deferred backlog — 33 open items (🟡 24 · 🟢 1 · ▶ 8)**, moved out of the live index 2026-08-19: open, but not actionable next session. Severity · id · claim preserved verbatim → [deferred-backlog.md](docs/progress/deferred-backlog.md)
- 🔴 **FUP-DM4-PRODROW** — ⭕ **UNBLOCKED 2026-08-18: the probe answered its blocker (no Cloud orphan surface), and this item's "~49 vanished" figure is WITHDRAWN as unsound arithmetic.** The subject is still erased, not reconciled — lead/backend
- 🟠 **FUP-42501-CONFLATES-GRANT-WITH-RLS** — ⛔ **coverage defect, NOT a vulnerability** (both tables ARE protected, by the missing grant). `42501` is both the RLS-refusal code AND Postgres's generic *permission denied for table*, so `throws_ok(…,'42501')` cannot tell them apart. Measured: of **12** live assertions in `252_authz_p0_isolation.sql`, `authenticated` lacks INSERT on **`rca_evidence`** + **`capa_action_evidence`** ⇒ those two pass on the **grant**, never reaching RLS. The P0 suite claims isolation on 12 tables and demonstrates it on **10**. ⚠ The tree already documented this trap **twice in prose** (`301`:21, `277`:328) and it recurred anyway. ⛔ Do NOT fix by granting INSERT — that widens real protection to make a test honest; fix the assertion. Model fix + the allow-leg differential that caught it: `345_previa_audit_door.sql` header. ⭐ **2026-08-19: filed as a GATE proposal, not a rule** (ADR 0127 rejected the rule form — a gate beats a rule where one is reachable). ⛔ **COST BASIS RE-DERIVED 2026-08-22 and it is 25–45× the filed figure — do NOT quote the old one.** The line said *"**15** `throws_ok` sites carry a bare `'42501'`, of 728 total references — so the gate costs 15 remediations"*. Re-measured by **paren-balanced parse** of all 206 suites (a line grep under-reports these 3–5-line calls, in the reassuring direction): **1358** `throws_ok` calls, **1214 assert no message at all**, of which **376 are `42501`** and **670 carry any generic Postgres code two locks can raise** (`42501` 376 · `23514` 189 · `P0002` 41 · `23505` 37 · `23503` 22). Textual `42501` refs are **813**, not 728 — the tree grew. ⚠ The filed **15** was **not reproduced by any property run**; "bare" is a third property nobody has identified. ⭐ The proposal's whole build/defer verdict rests on this number, and 15 vs 670 is the difference between *just do it* and *needs its own phase* — **re-derive before building, never quote** — backend/tester
- 🟡 **FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT** — `set_case_phase_result_override` (⛔ **grain-corrected**: the assignee arm applies **only while the phase is `active`**; once `completed` it is coordinator-only — the original line quoted one branch of two as the whole guard) admits **assignee ∨ coordinator** (per-*phase*), but the UI prop is a per-*case* boolean, so a non-coordinator phase assignee is offered nothing. ⛔ An **under-grant emits NOTHING** — no error, no log, no failing test — so no §6 gate can find it, unlike a dead-end door's visible `42501` — frontend/PO
- 🟡 **FUP-CASE-T5-MEUS-CASOS-UNREPOINTED** — T5's text says board rows re-point to manage; `meus-casos` rows still go to `/casos`. ⚠ Arguably **correct** (Meus Casos *is* name-attributed work, which D1 keeps there) — filed because the plan text and the behaviour disagree and one is wrong; leaving them disagreeing is what makes a later reader fix the wrong one — frontend
- 🟡 **FUP-VACUOUS-DETECTOR-FALSE-POSITIVE** — `check-vacuous-assertions.mjs` reports `ALL-ASSERTIONS-CONDITIONAL` when a helper is **declared inside** a test: the walk skips *child* functions but not a statement that **is** a `FunctionDeclaration`, so the helper's `return` revokes the guarantee for every later `expect`. Reddened the whole 8-gate chain; worked around by hoisting. ⛔ **Admission condition for any detector change: a NEW self-test reproducing the real vacuous shape, proven still RED after the fix** — a detector loosened on a false-positive report without that control is worse than the false positive — tester/lead
- 🟠 **FUP-SUPERSESSION-BADGE-LANE-BLIND** — `resolveSupersessionBadge` (`queries/submissions.ts`) mirrors `app.submitted_form_responses`' exclusion but **drops that rule's own `case_phase_id is null`**, while `listSubmissions` surfaces BOTH lanes. Standalone = correct (it IS ADR 0126 Am.1 §A's rule); **phase-bound = the chain-tip grain D8 examined and REJECTED** — the original reads "Substituído" before approval while `current_response_id` still points at it, flaps back on `reject_correction`, and an unapproved successor reads "Atual". ⭐ Differential: the **same pill** one file over is fed by `status === "approved"` (ADR 0085). ⭐⭐ And the lane conjunct **already exists in TS**: `isDashboardCountable` (`queries/dashboard.ts`) — which ARCHITECTURE.md calls *"the TS twin"*, singular — has `r.casePhaseId == null` explicitly, one file away. Two TS derivations of one choke-point; only one is sanctioned and only one is complete. ⚠ ADR **0074's** axis, not print-currency; found by accident in the §K sweep. ⛔ Read ADR 0074/0085 before fixing. Class: **a mirror inherits its source's PREDICATE, not just its shape** — frontend/backend
- 🟠 **FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS** — `reset role` restores the ROLE only; `request.jwt.claims` survives it, so a suite asserting "owner context, `auth.uid()` is NULL" may be asserting **as the last persona**. Found by construction in the S8 suite, where it hit the ADR-0134 **Amdt-6 pin itself**. ⭐ Class: *a pin whose stated PREMISE is false is the same defect as one that cannot fail* — and the comment above it reads like the verification. Measured: **172** files `reset role` (2179×), **39** ever clear claims ⇒ **136 CAN hold it**. ⛔ **136 is the capable population, NOT a defect count** — the real one is undetermined and no text filter decides it. Fix at the ROOT (one `test_helpers` verb that does both), gate in **pgTAP not lint**, red-first — backend/tester
- 🔴 **FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME** — ⭐ **RAISED 🟠→🔴 on QA's argument 2026-08-22:** the consequence is not a coverage gap but that an **empty-domain run prints the BYTE-IDENTICAL line a clean run prints** — and it has now produced a §6 step-1 record reading *"all four ARMs HOLD"* for a change that added a **PHI writer**. — `p0-authz-door-audit.sh:~231` bounds the predicate arm by a **name prefix**, not by a property. `ARM=census` correctly VIOLATED on the new gate `member_can_for`; the diff-scoped sweep it prints **as the remediation** then ran **ZERO cases** and printed **`BLIND: 0 ERROR: 0`** — a detector that found nothing because it looked at nothing, in a line a gate record reads as a clean pass. Measured: **802** DEFINER fns, **101** in domain, **42 outside it yet BOOLEAN** — incl. **`_audit_access_authorized`** (the PHI-read audit gate), `confidentiality_clearance_ok`, `member_can*`. ⛔ Outside the arm ≠ unswept, and 42 is not a defect count either. ⚠ Worse one level up: `app._case_caps` returns **`int`**, so it is in **no** arm's domain at all. **Cheapest real fix: forbid an empty-domain run from printing the line a clean run prints** — backend
- 🟠 **FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS** — a `next dev` started 11:20 served pre-Increment-2 code for files committed at 12:33/12:45/14:30. ⭐ One step from being filed as a **product bug**; the tester's clear-`.next`-rebuild discipline is why it wasn't. ⛔ **Mechanism NOT established** — the old console was not captured before the kill; *restarting fixed it* is a remedy, not a diagnosis. ⛔ **The suspect population is every GREEN run** — a failing spec gets investigated (that is how this surfaced), a passing one never does; size unestablished. ✅ **`e2e:prod` builds prod-standalone, so the phase gate is unaffected.** Cheap close, no mechanism needed: a **read** proof-of-life asserting something only HEAD has, before anything else — tester/lead
- 🟡 **FUP-CS2-QA-RESIDUE** — the **twelve** non-blocking QA findings from Increment 2 (M-1, M-5–M-8, M-11–M-17), filed so they do not leave with the review; full statements in the [r2 review](docs/reviews/case-surface-split-increment-2-review.md). ⭐ **Four are one class — an assertion that proves less than its name claims:** `356` §13's door-set pins are **count-keyed, not name-keyed** (a **swap** passes) · §2.1's "one body" is bounded to the `app` schema (a `public` hand-copy passes) · the read-only-shell E2E claim is a **2-item hand-list against a 16-member derived class** · the 404 matcher cannot say **which gate fired**. ⭐ **Plus QA C-3, the highest-value item:** promote the strip-S8-and-compare-md5 check — which settled "S1–S7 untouched" by computation — from a reviewer's one-off to a **pgTAP catalog assertion**, red-first, so the NEXT arm's author must prove they changed only their arm — backend/tester/frontend
- 🟠 **FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER** — the DB authors **103 informative** `42501` refusals (104 distinct, exactly **1** bare *sem permissão*) and the app layer **flattens essentially all of them**: of **63** `src/lib/**` modules mapping `42501`, only **2** recognise any message. Found when a PO-ruled gate message (Amdt 7's `all_phases` refusal) never reached the UI. ⛔ **The flattening is the only safe DEFAULT** — `42501`'s message cannot be trusted from the code (Postgres raises it for authored refusals AND raw *permission denied for table*), so undoing it is a **decision, not a fix**; 3 options in the body, incl. giving authored refusals their own `HC***` so `42501` stays reserved. ⚠ Any hand-list entry must be copied from `pg_get_functiondef` **verbatim and pinned**, or it degrades to the generic string **failing exactly as if absent, with nothing red**. ⭐ This is `FUP-42501-CONFLATES-GRANT-WITH-RLS` one layer up: same root, tests there, users here — backend/frontend
- 🟠 **FUP-CREATE-CASE-IS-ADMIN-DISJUNCT-VS-THE-NOUN-RULE** — `public.create_case` admits `app.is_admin()`, which `create_case_from_template` and `bulk_create_cases` do **not**. CLAUDE.md's noun rule (ADR 0078 A35) says `platform_admin` **may not touch commission content or PHI** — so a hatted platform admin creating a case in any commission of any tenant is noun-rule territory. ⚠ **Pre-existing and deliberately NOT removed** by Increment 2, which only stopped that arm carrying a **PHI write** it had just been handed. Measured: **11** `public` routines call `app.is_admin()`, enumerated in the body — ⛔ their split into "commission content" vs "sanctioned vocabulary/audit" is **a judgement, not a measurement** (not derivable from `prosrc`) and the PO should correct it rather than inherit it. Needs a **PO ruling**, not a patch — backend/PO
- 🟠 **FUP-GRANT-CASE-ACCESS-UNCHECKED-HAS-NO-COVERAGE** — `app._grant_case_access_unchecked` writes **`case_access_grants`** — the table deciding who can reach a case — with no authority check by design, and has had **no targeted test and no tracked class since 2026-07**. ⭐ Found by deriving a class **by property** instead of naming the instance that prompted it: the sweep returns **2**, and the second is the precedent the new PHI helper was modelled on. **The class predates the increment that revealed it.** ⚠ Untested ≠ unprotected — ACL `{postgres}`, `anon`/`authenticated` false; what is missing is a pin that this is still true tomorrow. ⛔⛔ **`ARM=census` prints a PRUNE hint naming both entries — correct about its own domain, wrong as advice; acting on it deletes the admitted gap.** ⭐ A gate telling you to erase the record of a gap deserves more attention than the gap — backend
- 🟡 **FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE** — a caller naming a function's **old arity** in a `has_function_privilege('…(uuid,text,…)')` string does not fail an assertion; it **ABORTS the suite** as a plan mismatch, in an unrelated file, naming no function (`Result: FAIL` with **zero** `# Failed test` lines — the never-ran shape wearing its opposite). Hit on the Increment-2 `DROP`+`CREATE`; the overload pin catches **ambiguity** and is structurally blind to **arity**. Swept: **9** textual hits, **1** executable — fixed, and `357` 1.6/1.7 now pin `oid::regprocedure::text`, the *same string form* the hazard uses. ⛔ Open on the **class**, not the two doors: whatever gate is built must go **RED on a deliberately stale signature** — a sweep of this shape that finds nothing is indistinguishable from one that cannot — backend
- 🟡 **FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED** — ⭐ **RAISED 🟢→🟡 on QA's argument 2026-08-22:** the schema it bounds now **hosts a PHI writer**, so the one config line carries more than it did when this was filed. — ⛔ **informational, NOT a live hole; do not report it as one.** Measured 2026-08-22: of **467** functions in schema `app`, **237 are `anon`-executable** — **228** by `proacl IS NULL` (the permissive default nobody wrote) and **9** by an explicit `=X/postgres` entry, four of which are **authorization predicates** (`is_admin`, `is_member_of`, `is_org_admin_of`, `is_staff_admin_of`). The ONLY thing bounding this is **one config line** — `supabase/config.toml:13` does not expose `app` to PostgREST — so the ACLs are not holding the line and an auditor reading them would conclude they were. ⭐ First reported as *"`is_member_of` is wider than every sibling"*: every clause true, the framing wrong in this repo's standing way — the instance found, not the class (it missed a second explicit member and the 228-strong dominant mechanism), and a one-outlier framing invites a one-function fix that changes nothing. Needs a **decision**, not a patch; ⛔ never smuggled into a feature migration — backend/PO


_**Three items RESOLVED by the DSR remediation round, index lines rotated 2026-08-21** → [follow-ups-archive.md](docs/progress/follow-ups-archive.md): **FUP-DISPOSE-EVENT-DOOR-GATE-BLIND** (keystone `352` run **inside the full suite** on a fresh reset and re-neutralized there — the item closed on the RUN, never on the file existing) · **FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES** (the four column doors have their first operational procedure, and the bytes runbook now names its own substrate) · **FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING** (PO ruled the copy stays; the training premise it rests on is recorded at the pilot-decision surface, which was the item's actual requirement). Bodies stay in [follow-ups.md](docs/progress/follow-ups.md)._

_Resolved, rotated out of both live files → [follow-ups-archive.md](docs/progress/follow-ups-archive.md):
**FUP-DM1-CEILING · FUP-DM1-E2E · FUP-DM1-DISPOSE** (discharged by DM2 S1/S4/S2) · **FUP-F2-BUCKETS**
(`meeting-attachments` retired in `20260921000300`, pinned by pgTAP `325`) · **FUP-PDF-3** (both doors
now `RETURNS public.printed_document_public`; ADR 0111, pgTAP `323`)._

_14 more index lines (the 2026-08-18 resolved set, `FUP-DM5-*` and peers) rotated 2026-08-18 → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) § "Index lines rotated from PROGRESS.md 2026-08-18"; their bodies remain in [follow-ups.md](docs/progress/follow-ups.md) pending body rotation._

_**FUP-DM5-NO-ANSWER-VS-NOTHING** (🔴, the class) rotated 2026-08-19 → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) § "Index line rotated from PROGRESS.md 2026-08-19" — all six instances closed; last one (`--allow-orphans`) fixed by ADR [0128](docs/decisions/0128-unproven-is-not-clean-capture-outcome-classes.md). Body stays in [follow-ups.md](docs/progress/follow-ups.md); ⭐ the one-sentence class statement is deliberately KEPT there as a review lens, not archived away._

_**FUP-DM5-BACKUP-IS-PHI-EXPORT** (🔴) rotated 2026-08-19 → the same archive section — ✅ **RESOLVED by execution**, not by decision: both remaining deliverables (destination path, first run) discharged against the local stack; record [phi-backup-run-log.md](docs/deployment/phi-backup-run-log.md). Body stays in [follow-ups.md](docs/progress/follow-ups.md). ⛔ **Its two residues are the NEW 🔴/🟠 lines above — the close is bounded, not total.**_

_Parked / deferred backlog — full detail (owner, rationale, repro) relocated to **[deferred-backlog.md](docs/progress/deferred-backlog.md)** to keep this tracker scannable; titles + pointers kept live below._

- 📦 **Parked backlog — 27 items**, index and full detail (owner, rationale, repro) → [deferred-backlog.md](docs/progress/deferred-backlog.md)


