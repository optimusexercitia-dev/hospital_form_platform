# DM5 gate step 4 — the seven PO decisions (rotated from PROGRESS.md 2026-08-18)

> Rotated at the size rotation: PROGRESS.md was 142 KB against §7's <60 KB target, and this
> docket is **discharged** — all seven decisions were ruled 2026-08-18. The two rulings that
> created ongoing obligations (**C1** the PHI-disposal rehearsal, **C2** the 407-door Tier 1)
> stay live in PROGRESS.md § Critical FUP; verified present before this was moved.
>
> Links are repointed root-relative → `docs/progress/`-relative, and in-file `#anchors` now
> target `../../PROGRESS.md#…` — a **verbatim** rotation 404s its own links.

---

## 🛑 DM5 gate step 4 — **the seven PO decisions are ✅ ANSWERED (2026-08-18). Two of the answers are WORK, not completions.**

> **Status 2026-08-18: all seven gate-step-4 decisions are ruled and recorded** — in their ADRs, in
> § Decisions, and in the follow-up bodies + index lines. The docket that blocked the Document Model
> program's final phase is discharged. Full rulings: **§ Decisions, the eight `2026-08-18` rows.**
>
> ⛔ **DO NOT READ "ANSWERED" AS "DONE".** Two rulings created obligations that outlive this phase and
> now live in **[§ Critical FUP](../../PROGRESS.md#-critical-fup--the-must-not-be-forgotten-list)**:
> - **C1** — the PHI-disposal runbook must run **end-to-end before any real patient record is
>   loaded**. The pilot risk acceptance is *bounded by that rehearsal* and does not survive without it.
> - **C2** — Tier 1 of the 407-door sweep (PHI / tenancy-crossing) is **sized but not yet counted**;
>   deriving its population is step one.
>
> ⚠ **The docket was over-wide by one item and that is worth remembering, not just fixing.** It listed
> ADR 0114 **O4** as owed; O4 was **ruled 2026-08-13** (ADR 0118 — 120 s / 300 s signed-URL TTLs), and
> ADR 0120's open-items section — the phase review's **own cited source** — named only O1 and O2. The
> review widened its source, PROGRESS.md inherited it, and a PO was asked to decide something already
> decided. ⭐ *An over-wide list of what is owed costs the same round as an under-wide one.*
>
> ↩ **The docket as it stood 2026-08-17 — all seven rows with their "why it blocks" reasoning —
> rotated 2026-08-18 → [dm5-wave-d-retirement.md](dm5-wave-d-retirement.md)**
> § "the SEVEN-DECISION DOCKET as it stood before the rulings", verbatim, `cmp`-verified.
> **The answers are below and in § Decisions; that archive holds the questions.**
>
> ### ✅ Step 1 DONE — where each answer was recorded
>
> | # | ruling | recorded in |
> |---|---|---|
> | 1 | D9 ratified **accepted-unverified on Cloud** + runbook HARD STOP | ADR 0120 D9 · [runbook §6](../deployment/phi-disposal-runbook.md) |
> | 2 | O1 **20 yr clinical / 5 yr governance** · O2 expiry = *"any external user can upload"* | ADR 0114 Open items · ADR 0120 open/deferred |
> | 3 | Uploader visibility **NOT added**; S1-O3 **closed** | ADR 0117 § S1-O3 · ADR 0116 §11 |
> | 4 | Supersede collision → **(b)**, trigger moves to retention expiry | ADR 0121 **Amdt 2** · ADR 0120 D11 |
> | 5 | 407-door triage → **two tiers** | **Critical FUP C2** · FUP-AUTHZ-COMMAND-DOOR-UNSWEPT |
> | 6 | S2/S3/S5 `backend-state.md` sections → **backend, one task** | **FUP-DM5-BACKEND-STATE-SLICE-SECTIONS** (filed 08-18; it had no ID) |
> | 7 | Pilot risk **accepted, bounded by one rehearsal** | ADR 0121 **Amdt 3** · **Critical FUP C1** |
>
> ### What the next session works in, in order
>
> 1. ~~**#6's task**~~ ✅ **DONE 2026-08-18** — `backend` wrote the S2/S3/S5 `backend-state.md` sections
>    (`FUP-DM5-BACKEND-STATE-SLICE-SECTIONS`), catalog-derived; **S4 added on the PO's ruling** in the
>    same pass. ⚠ **It surfaced 4 wrong figures in the DM END STATE stamps** — chief among them a
>    trigger on `responses` that **does not exist** (lead-verified: 5 user triggers, none touches
>    `securable_resources`; the securable is minted lazily inside `mint_printed_document`, and ADR 0120
>    **D17.2** rejected the trigger **by name**). ⭐ *The stamp did not lag the design — it asserted the
>    mechanism the design wrote a paragraph to refuse.*
> 2. ~~**§6 step 5 — Record + rotation**~~ ✅ **DONE 2026-08-18.** Rotated per the phase QA's guidance
>    **plus** the phase rotation the Record step itself requires: **Test Run Summary** → 1 row (the
>    declaring-green run); the two **QA Verdicts** rows compressed to their contractual one line; and
>    **the entire 34.5 KB DM5 phase section + the answered docket** → the DM5 record. **146 KB → ~111
>    KB.** Every move: appended **before** the cut, `cmp`-verified, links repointed, **0 broken links
>    across all four files** (verified, not assumed). ⛔ Follow-up index lines **not** rotated (R3);
>    § Critical FUP **not** rotated. ⚠ **Still ~111 KB against §7's "well under 60 KB"** — the residue
>    is structural, not phase detail: **Follow-ups 27 KB · Phase Status 26 KB · Decisions 17 KB · Bug
>    Log 15 KB**. Closing that gap means rotating *those*, which is a separate decision with its own
>    R3-shaped risk, not a leftover of this pass.
>    ⭐ **Found while doing it: `test-run-archive.md` carried 18 links already broken at HEAD**, from
>    earlier rotations that skipped the repoint step. Fixed. *A verbatim rotation that does not repoint
>    is this repo's standing rotation defect, not a one-off — the check belongs in the recipe.*
> 3. ~~**THEN the `db push` question**~~ ✅ **DONE 2026-08-18** — PO-authorized and executed to carry out
>    decision #1. All five migrations applied; remote at `20260928000500`; **8 buckets retired, 4
>    survive; the recusal PHI fix is live.** Measured facts in § "State". ⭐ **The mechanism finding is
>    worth keeping:** the sanctioned way to retire the buckets **was** migration `20260927000400`, which
>    also drops four `storage.objects` policies — *the Storage-API route would have deleted the buckets
>    and left the policies behind.* **The noun "retire eight buckets" was materially narrower than the
>    act that performs it**, and the narrower-looking route was the less complete one.
>
> **Full reasoning → [dm5-phase-review.md](../reviews/dm5-phase-review.md) §§5–6 and
> [follow-ups.md](follow-ups.md).**

### ✅ COMPLETE — **DM5: Wave D + retirement** (2026-08-14 → 2026-08-18) — the Document Model program's FINAL phase

> **All five §6 gate steps passed.** Steps 1–3 on 2026-08-17 (pgTAP **194f/6392** · `e2e:prod`
> **GREEN 1121p/0f/0 did-not-run** · slice QA ✅ r2 · **DM5 PHASE QA ✅ APPROVED r2**); **step 4 (PO)
> 2026-08-18** — all seven docket decisions ruled (§ Decisions, the eight `2026-08-18` rows); step 5
> (Record + rotation) 2026-08-18.
>
> ↩ **Full phase detail — 34.5 KB, every slice, both incidents and the enumeration-boundary lessons —
> rotated 2026-08-18 → [dm5-wave-d-retirement.md](dm5-wave-d-retirement.md)**
> § "Rotated from PROGRESS.md 2026-08-18", **verbatim, `cmp`-verified, 19 links repointed.**
> Slice records: [S5](dm5-s5-operational-closure.md) ·
> [surface verification](dm5-surface-verification.md) ·
> [plan](../plans/dm5-wave-d-retirement-plan.md). ADRs
> **[0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D18) ·
> **[0121](../decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)** (+**Amdt 2/3**, the
> two 2026-08-18 rulings) ·
> **[0122](../decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)**.
>
> **Slices:** S0 ✅ · ~~S1~~ ⛔ WITHDRAWN, never built · S2 ✅ · S3 ✅ · S4 ✅ · S5 ✅ · follow-up batch ✅ · S6 ✅.
>
> ⛔⛔ **CLOSING THE PHASE DID NOT CLOSE ITS OBLIGATIONS — and this is the sentence the rotation exists
> to protect.** Two survive in **[§ Critical FUP](../../PROGRESS.md#-critical-fup--the-must-not-be-forgotten-list)**:
> **C1** (the PHI-disposal runbook is **UNREHEARSED**; the pilot risk acceptance is *bounded* by that
> rehearsal) and **C2** (the 407-door Tier 1 sweep). ⚠ Also still open and NOT discharged by
> completion: **D11's rebuild** (ruled, gated on C1 by ADR 0121 D1) and the `superseded`-vs-
> `retention_expired` build-time detail. ⭐ *A deliverable assigned to a phase disappears when that
> phase closes cleanly* — which is exactly why C1/C2 live in a section that is never rotated.

### ⬛ Closed work — DM4 · DM3 · DM2 · the "Recently completed" index · ad-hoc completed work

> ↩ **All five blocks rotated 2026-08-17** (§6 step 5) → **[phase-status-archive.md](phase-status-archive.md)
> § "Rotated from PROGRESS.md 2026-08-17"**, preserved **verbatim before the cut** (85 lines,
> `cmp`-verified). § Current Phase Tasks is for the **current** phase; every one of these is closed
> and has its own record.
>
> **Where each lives now** — the Phase Status table above keeps a row for each, forever:
> **DM4** (Wave C, referrals) → [dm4-referrals.md](dm4-referrals.md) ·
> **DM3** (Wave B, controlled documents) → [dm3-controlled-documents.md](dm3-controlled-documents.md) ·
> **DM2** (orchestration + Wave A) → [dm2-orchestration-wave-a.md](dm2-orchestration-wave-a.md) ·
> **REG·KIND / RDR / ETH·E4 / ACT / PDF·P1+P2 / QO·A+B / MIN / AFF / PCI+TV** and the ad-hoc items →
> their `docs/progress/*.md` records, linked from the archive block and from the Phase Status rows.
>
> ⚠ **Two DM3 findings that are NOT superseded and must not be re-learned** — kept here rather than
> rotated, because both describe how a *green gate* can be wrong: the M1 **backfill that masked a
> broken CREATE path** (every create raised `23503` for a whole phase, invisible to every incremental
> run — **only the mandatory fresh reset saw it**), and the flag that **gated the last step of a
> corridor instead of the corridor** (flag OFF still PUT real bytes).
> ⚠ **Ethics letters home on the `case` securable resource, NEVER `controlled_document`** — else
> `HC0D6` refuses the enforcing label and the D15 ceiling silently vanishes.
>
> ⚠ **Open items from closed work do NOT close with the work.** Still live, and tracked in
> § Follow-ups rather than in the rotated cells: **BUG-QOB-004** · **FUP-QOB-1/2** ·
> **BUG-BOOTSTRAP-001** · **FUP-QO-6/9** · **FUP-PDF-2..4** · **FUP-MIN-CUTOVER** ·
> **FUP-AFF-1…4** · **FUP-PCITV-1** · **FUP-ETH-A11Y-1** · **FUP-ETH-ROLES-1** ·
> **FUP-E2E-SERVER-DEAD-1** · **FUP-ACT-DISPOSE-UI** · **FUP-ACT-CAPA-ASSIGN** ·
> **FUP-ACT-HATLESS-AUDIT**.
> ⛔ **REG·KIND shipped with NO tester pass and NO QA review** (steps 2–4 unrun by PO direction) and
> **AUDIT-INVOKER-WRAPPER was never QA-reviewed** — neither gap is closed by rotation.

### 📋 Remaining pre-pilot work

Scope: ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md) (12 initiatives), re-expanded
by [0086](../decisions/0086-flexible-forms-pre-pilot.md) (FF-1…FF-5), re-gated by
[0093](../decisions/0093-phase-16-standards-crosswalk-replan.md) and
[0097](../decisions/0097-hospital-affiliation-person-identity.md). **All complete**, as are the ACT
cutover and both pushes. Completed items are not re-listed. What is actually left:

**0. 🔴 PILOT-GATE CHECK — the LGPD Art. 18 referral-erasure path must have a working UI route
(FUP-ACT-DISPOSE-UI).** A **gate check, not a follow-up entry**, on the Stage-3 QA reviewer's explicit
recommendation — *"'standing in prose alone' once meant a thing ran once in three weeks"* (the failure
ADR 0079 was written about). **Stated so it can be run and can fail:** name a persona who can (a) reach
the surface hosting the dispose affordance AND (b) pass `dispose_referral_phi`'s own gate. Today **no
such persona exists** — the two sets are disjoint (catalog-verified), so subject-erasure is API-only.
**Decision owner: PO** — *where* it mounts is a product call; *whether* it must work before pilot is
not. ⚠ Precedent: `20260917000400` restored this door's tenancy-admin arm specifically to un-strand
this obligation after QO·B cut it. Mechanism → [follow-ups.md](follow-ups.md).

**1. 🔴 PILOT-GATE CHECK — DM5 exits with a KNOWN, runbook-mitigated PHI-DISPOSAL GAP, and it must be
carried here, not only in the phase record.** ⭕ **Added 2026-08-17 at the DM5 phase QA (R4): the DM5
plan (S5.D.4) required this to appear "in S6's canon sweep AND in the pilot gate, never only here",
and it was absent from both.** This section read *"All complete … What is actually left:"* followed by
a single item, so two PHI-tier obligations were invisible at exactly the place a pilot decision is made.

- 🟠 **FUP-DM5-DISPOSAL-JOB — nothing completes a disposal automatically.** `complete_document_disposal`
  exists but its only production caller is `reclassifyDocument`; **the job does not exist.** Filed by
  the plan (S5.D.3) as *"a 🔴 BLOCKING pre-pilot follow-up — not a nice-to-have."* A
  `disposal_pending` row that never completes means **bytes that should have been destroyed still
  exist** — ⭐ which is why ADR 0099 **D10**'s rationale (*"a stale row nobody looks at harms nobody"*)
  **inverts for PHI**, and overturning D10 needs its own ADR. ⚠ D2's obvious design does not work: the
  Storage API is unreachable from SQL, so a pure-SQL `pg_cron` job automates only the half that was
  never the gap.
- 🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** — the runbook's backup half produces **68 PHI-tier files**
  (Rule 12 / LGPD). The PO-decided values are in the runbook; what remains is the per-machine
  destination path.
- 🔒 **The runbook sequence is UNREHEARSED** — a binding DM5 gap, still open. *Naming an owner is not
  a rehearsal, and writing a runbook is not running it.*

**Decision owner: PO** — whether the pilot may proceed over a manual-only disposal path is a risk
acceptance, not an engineering call. Detail → [S5 record](dm5-s5-operational-closure.md)

> ### ✅ RULED 2026-08-18 — **the pilot MAY proceed, BOUNDED by one rehearsal.** The gate check survives; its question changed.
>
> ⛔ **This item is NOT discharged.** What was owed was the *decision*, and it is taken (ADR 0121
> **Amdt 3**; § Decisions). What remains is the **deliverable**: the runbook must be
> **executed end-to-end against test data BEFORE any real patient record is loaded** —
> **[§ Critical FUP](../../PROGRESS.md#-critical-fup--the-must-not-be-forgotten-list) C1**, which carries the trigger.
>
> ⚠ **So re-read the gate check with its new question.** It no longer asks *"may we?"* — it asks
> **"has the rehearsal happened?"**, and the honest answer today is **no**. `FUP-DM5-BACKUP-IS-PHI-EXPORT`
> rides the same run (the destination path is owed at first execution).
> ⭕ *This block described the decision as owed for the whole of the day it was ruled — the stale form
> sat at the exact place a pilot decision gets made, which is the failure R4 added it here to prevent.*
§ 6 (**20** NOT-COVERED items) + the [disposal runbook](../deployment/phi-disposal-runbook.md).
