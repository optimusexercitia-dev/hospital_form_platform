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

**0. ✅ PILOT-GATE CHECK — DISCHARGED 2026-08-20 (DSR Slice 2, ADR 0130). The LGPD Art. 18
erasure path has a working UI route (FUP-ACT-DISPOSE-UI).** A **gate check, not a follow-up entry**,
on the Stage-3 QA reviewer's explicit recommendation — *"'standing in prose alone' once meant a thing
ran once in three weeks"* (the failure ADR 0079 was written about). **Stated so it can be run and can
fail:** name a persona who can (a) reach the surface hosting the dispose affordance AND (b) pass the
disposal door's own gate.

**The check, run and recorded.** Persona **`pqs.a@test.local`** (`pqs_member` of Hospital Central A):
(a) reaches **`/o/rede-a/titulares`** — the DSR task inbox, behind the `dsr` flag — because
`app.can_execute_dsr_task` admits `app.is_pqs_operator_of_for(hospital)`; and (b) passes
`dispose_event_phi`'s own gate (`app.is_tenancy_admin_of(commission) OR
app.is_pqs_operator_of(hospital)`), catalog-verified. **Both halves executed in a browser**, not
argued: `e2e/dsr-subject-requests.spec.ts` § *"the PQS executor disposes from the inbox under their own
session"* clicks the affordance and then asserts `patient_safety_event.phi_disposed_at is not null` and
`event_patient` gone, via the service role.

⚠ **What was actually wrong, and what changed.** The two sets were disjoint because **no surface
existed**, not because the gates were misaligned: the referral dispose dialog had a component, and the
case/event dispose actions had **no caller anywhere in the app**. The inbox is that surface. ⛔ **No
disposal gate widened** — the executor fires the module's own door under their own session (ADR 0130
Decision 2), which is exactly why the check can be answered without touching authorization.

⚠ **Bounded, so this is not read as more than it is.** The corridor proven is the **event** lane;
`dispose_case_phi` and `dispose_referral_phi` ride the identical inbox path and the same fan-out, but
their end-to-end browser proof is the pgTAP matrix (349), not this E2E — disposal is irreversible and
pointing the spec at seeded records would erase PHI ~900 other tests share. The **meetings** lane is
NOT discharged here and is not claimed: ADR 0056 Consequence (a)'s missing meetings-dispose UI moves to
DSR Slice 3 with the adjudication that mints the task (ADR 0130 Amendment 2 item 3).

⚠ Precedent, retained: `20260917000400` restored this door's tenancy-admin arm specifically to un-strand
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
- ⬛ **FUP-DM5-BACKUP-IS-PHI-EXPORT — ✅ RESOLVED 2026-08-19 by execution.** The § 6b backup half was
  run end-to-end on the local stack (census **812 files / 231 PHI-tier** — the drill's 68 is a 2026-08-17
  figure and the volume has grown), the per-machine destination path is set and recorded, and the
  archive was verified catalog-compared then destroyed key-first. Record:
  [phi-backup-run-log.md](../deployment/phi-backup-run-log.md).
  ⛔ **Two residues stay on the pilot gate, and one is 🔴:**
  **🔴 `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`** — the procedure is `docker exec … tar`, local-only, and
  Supabase's managed backups **exclude Storage objects by documented design**, so **the pilot platform
  has no Storage recovery point at all**; and **🟠 `FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED`** —
  the DB half's dump file and scratch database are plaintext PHI with no handling rule, and that one
  **is reachable on Cloud today**.
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

**2. 🟠 PILOT-GATE CHECK — the platform's ERASURE CLAIM rests on a control the software does not
enforce, and that risk acceptance is recorded HERE because an ADR is not where a pilot decision is
made.** ⭕ Added 2026-08-20, discharging the requirement ADR
[0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) states in its own
Consequences: *"it must be recorded **where the pilot decision is made** and not only here — the same
requirement Critical FUP C3 carries for its own acceptance."*

**What was accepted.** ADR 0131 (PO, 2026-08-20) ruled that **PHI erasure reaches DESIGNATED PHI
fields; it does not extend to columns that merely MAY contain PHI.** In scope and owed perfectly: the
three Class-1 modules — `event_patient`, `referral_patient`, and `patient_identifiers` anchored on the
patient `participants` row — plus the fields explicitly designated to carry patient data. Out of scope
for the pilot: free text and titles.

**What is knowingly retained — measured, not estimated.** **133 candidate columns** across
`dispose_case_phi`, `dispose_event_phi` and `dispose_referral_phi`, plus a seven-table `ethics_*` lane
no door touches. Record:
[door-erasure-freetext-census.md](door-erasure-freetext-census.md). ⛔ **This is a risk acceptance,
not a finding of absence.** The census is retained *because* an acceptance with no record of what was
accepted is not an acceptance, and a future reader must not re-read this close as "nothing found".

**The control set is two-layered, and one layer is bounded** (ADR 0131 Amdt 2):
- **Preventive — training**, plus the `"Não inclua dados do paciente."` helper text on free-text and
  title inputs. ⚠ The software **cannot detect** PHI typed into a title; this is a process control.
- **Corrective — the reopen → edit → re-sign corridor**, already built and already documented to
  operators in `DSR_ATTEST_PROCEDURE_COMMON`. ⛔ **Bounded**: only `rca` is fully covered; six lanes
  each have a structurally terminal state no door reverses, and the referral corridor never restores
  the source's own free text at all. **For a `distributed` or `cancelled` meeting's non-erased
  columns there is NO removal path by any door.** That is the honest statement of the exposure.
  ⚠ **Where that seven-lane figure comes from, because it is more precise than the ADR it sits
  beside.** ADR 0131 **Amendment 2** measured the **meeting** corridor only, and says so — *"Only the
  MEETING corridor has measured bounds … neither bound above may be generalised in either
  direction."* The seven-lane numbers are **not** a generalisation of it: they come from the separate
  corridor measurement of 2026-08-20 (commit `3aa9a747`) — the live catalog plus a **59-probe
  executed differential**, 7 positive controls and a THAW control, rolled back with the pre-state
  re-verified. `FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED` remains open for its **residue** items,
  not because the coverage question is unmeasured. ⛔ Cite that measurement, never Amendment 2, for
  any lane other than `meeting` — a newly precise number that arrives without a named measurement is
  indistinguishable from a widened one.

**PO copy ruling, 2026-08-20:** `DSR_RESIDUE_NOTICE` line 1 (*"O descarte apaga os dados do paciente
armazenados no banco para este registro"*) **stays as written**, on the training premise.
⛔ It is therefore **conditionally** true — it holds *provided PHI was entered only in PHI fields* —
rather than structurally true. ⛔ **Not falsified; its premise is newly explicit**, and this paragraph
is where that premise is on the record. `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING` closes on this ruling.

⚠ **What this acceptance does NOT cover, so it is not over-read:**
- ⛔ The **in-scope** erasure working is **not** part of the acceptance — it is an obligation
  (ADR 0131 D4(a): *"In-scope reach that is not working is a DEFECT, not a rollback candidate"*).
  `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW` destroyed exactly that and was fixed, not accepted.
- ⛔ The **Class-2 professional-identity** data subject in the `ethics_*` lane — the accused
  professional, whose allegation text is personal data about them and for whom the DSR workflow can
  return `granted` **with no door to call**. ADR 0131 is written about PHI; **whether it also rules on
  Class-2 erasure is still the PO's to confirm.** Nothing here decides it.

**Decision owner: PO** — accepting a legal-facing erasure claim that rests on training is a risk
acceptance, not an engineering call. It is taken; this entry is its record at the pilot gate.

**3. 🟢 PILOT-GATE CHECK — the `dsr` module is UNREACHABLE on the deployed project until a push, and
the go-live flip is now authorised and ordered.** ⭕ Added 2026-08-21, discharging QA blocker **C1**
of the DSR operational-remediation review: the decision below was ruled on 2026-08-20 and, until this
entry, **existed nowhere but inside the comment header of the migration it authorised.**

**The state that made it necessary, measured.** `20261001000000` inserts the `dsr` flag `false`, and
the **only** writer that ever set it true was `supabase/seed.sql`, which runs on `db reset` and never
on the deployed project. So on production the whole module was unreachable end to end — every door
raising `HCDS1`, `list_my_dsr_hospitals()` returning `'[]'`, `/o/[org]/titulares` 404ing for every
persona **including the appointed Encarregado** — while local and E2E were green throughout, because
the seed path hid it. ⭐ *A feature flag inserted `false` and flipped only by `seed.sql` is OFF in
production while every gate is green.*

✅ **RULED (PO, 2026-08-20): FLIP IT, in its own migration, ordered AFTER the erasure fix.** Shipped
as `20261003000200_flip_dsr_flag_on.sql`; ordering verified in `schema_migrations`
(`…000000` fix → `…000100` scrub retirement → `…000200` flip). ⛔ **The ordering is the guarantee, not
cosmetics:** reachable-before-fixed would have handed an executor a working button that silently
accomplishes nothing on a `completed` RCA, a `completed`/`cancelled` CAPA plan, a terminal interview,
or a locked meeting's case notes.

- **Platform-wide, and not by preference** — `app.feature_flags` is keyed by feature alone, with **no
  tenant dimension**. Per-tenant enablement is a schema change; it was offered as a distinct option
  and not taken. The migration answers this by fiat, and that is a **constraint**, not a choice.
- **Critical FUP C1b does NOT gate this, and the two are disjoint mechanisms** — C1b rehearses the
  **Storage-bytes** runbook; the DSR doors erase **columns**, and the paths do not touch (see
  [phi-column-disposal-procedure.md](../deployment/phi-column-disposal-procedure.md) § 0).
  ⛔ **Disjoint is not unrelated:** C1b's own trigger is *before any real patient record is loaded*,
  and a reachable DSR console on a tenant holding real PHI with no rehearsed byte-disposal path is a
  state to enter deliberately. **The flip does not create that state — the push plus real data
  would.**

⛔ **THE PUSH IS A SEPARATE DECISION AND HAS NOT BEEN TAKEN.** Nothing is pushed, no `db push` has
run, and the deployed project is unchanged. This entry authorises the migration's presence on the
branch; it does not authorise its application.

⚠ **Why this entry is dated a day after the decision, recorded because the lapse is the lesson.** QA
searched this file, the round's plan, PROGRESS.md, three ADRs and `backend-state.md` for the
authorisation and found it in **none** of them, and returned CHANGES REQUESTED on exactly that basis.
A decision witnessed only by the artifact it authorises cannot be checked against anything — the
artifact and its warrant are the same text. The engineering was correct throughout; what was missing
was the record that anyone was allowed to do it, and that is a **lead** failure, not an implementer's.

**4. 🟢 The referral dispose dialog is REMOVED — a ruling REVERSED the same day its premise was
measured false.** ⭕ Added 2026-08-21 (QA blocker **C3**). The PO first ruled *"make it reachable"* on
the understanding that a fixture persona was merely missing. Measured: route access admits active
hats `staff`/`staff_admin`; `can_dispose_referral_phi` admits `org_admin`/`hospital_admin`/
`nsp_coordinator`/`pqs_member`. **Disjoint under one session's single hat — in production, not just
in the seed.** No persona exists or can be built; it was a **PRODUCT** gap.
⛔ **Not fixed by widening anything.** The DSR task inbox already reaches that door for exactly the
hats that hold the gate (ADR 0130 D11, *"one inbox"*), so the dialog was deleted rather than the gate
opened. Full reasoning: ADR
[0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) **Amendment 5**.
⚠ **Residue:** `dispose_referral_phi` is now the only one of the four lanes with **no browser-level
coverage on the surface that can reach it** (`FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE`),
and the bug it descends from closed **on removal of its subject, not on achieved coverage**.
