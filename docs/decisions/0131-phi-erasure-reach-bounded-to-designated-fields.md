# ADR 0131 — PHI erasure reach is bounded to DESIGNATED PHI fields; free text is out of scope for the pilot

**Status:** **Accepted** (PO decision, relayed 2026-08-20 after discussion with the
development team) · **Date:** 2026-08-20 · **Feature:** scope ruling on the PHI-disposal
doors · **Resolves:** `FUP-DOOR-ERASURE-FREETEXT-CENSUS` (🟠) and
`FUP-ETHICS-LANE-NO-ERASURE-DOOR` (🔴) — **by ruling, not by remediation** ·
**Relates:** ADR [0056](./0056-phi-disposal-closure-narrowed-claim.md) (the doors and the
narrowed storage claim), ADR [0130](./0130-dsr-subject-request-workflow.md) (the DSR
workflow that calls them), ADR [0035](./0035-lgpd-anvisa-regulatory-posture.md) (the
governing regime), CLAUDE.md **Rule 12**.

## Context

The DSR Slice 4 meeting-door widening (ADR 0056 Amendment 1) established a working rule:
*a PHI-capable column may not be left both unredacted and unnamed.* Applied consistently,
that rule makes **every free-text column on a lane** a candidate for erasure, because any
of them **may** receive PHI regardless of design intent.

A census of the three remaining doors measured what that would cost
([door-erasure-freetext-census.md](../progress/door-erasure-freetext-census.md)):
**133 candidate columns** across `dispose_case_phi`, `dispose_event_phi` and
`dispose_referral_phi` — titles, notes, rationales, `jsonb` payloads, revision histories,
and a whole seven-table `ethics_*` lane no door touches. None of these are designated PHI
fields; all of them *could* hold PHI if an operator typed it there.

## Decision

**PHI erasure reaches DESIGNATED PHI fields. It does not extend to columns that merely
MAY contain PHI.**

1. **In scope — confirmed PHI columns and tables**, executed perfectly: the **three Class-1
   modules** of Rule 12 — `event_patient`, `referral_patient`, and `patient_identifiers`
   anchored on `patient_participants` — plus the fields explicitly designated to carry
   patient data. These must be erased completely, provably, and with their doors properly
   gated and keystoned. ⚠ **`patient_xref` is deliberately NOT in this list**: its own
   catalog comment states it holds non-reversible keyed hashes with no names and no raw MRN,
   so it *"is NOT a PHI store … this layer adds no fourth PHI table"*. It is maintained by
   triggers off the three modules and retain-marked on erasure; treating it as a fourth PHI
   store would contradict Rule 12.
2. **Out of scope for the pilot — free text and titles that may incidentally contain PHI.**
   No door is widened to cover a column on the grounds that PHI *could* be typed into it.
3. **The compensating controls are TWO-LAYERED** — ⚠ *this item said "the compensating
   control is TRAINING, not software", which understated the platform's own position; see
   **Amendment 2**.*
   - **Preventive — training:** users enter PHI exclusively in PHI-specific fields
     (reinforced by the `*.title` helper text promoted in Amendment 1).
   - **Corrective — the reopen corridor:** `reopen_meeting` → edit → re-sign, already BUILT,
     already the sanctioned surgical prose-redaction path under ADR 0130 D7, and already
     documented to operators in `DSR_ATTEST_PROCEDURE_COMMON`. ⛔ **Bounded**: it reaches
     only 2 of the 4 locked meeting states, and its gate is narrower than the disposal
     door's. Amendment 2 carries the measurements.
4. **Already-implemented erasure reach is MAINTAINED, not rolled back — with one bounded
   exception.** The ADR 0056 Amendment 1 meeting widening (10 columns) stays as built. This
   decision bounds future extension; it does not reverse shipped behaviour. ⚠ **Revised by
   Amendment 3** (2026-08-20) after shipped reach was measured to be non-functional:
   - **(a) In-scope reach that is not working is a DEFECT, not a rollback candidate.** Reach
     over Decision 1's designated PHI is **fixed**, never removed. ⛔ Discovering a failure
     **never** narrows a Decision-1 obligation.
   - **(b) Out-of-scope reach (Decision 2 free text) that is not working MAY be rolled back**
     — by an **explicit PO decision, recorded per lane**, citing the measurement that showed
     the failure.
   - **(c) A failure is never self-executing.** A rollback under (b) must name what is removed
     and what the residue becomes. *"It was broken"* is a trigger, not a rationale.
5. **The working rule from Amendment 1 is NARROWED**: *a **designated PHI** column may not
   be left both unredacted and unnamed.* For non-designated free text, neither redaction
   nor disclosure is required.

## Consequences

- **`FUP-DOOR-ERASURE-FREETEXT-CENSUS` and `FUP-ETHICS-LANE-NO-ERASURE-DOOR` close as
  RULED OUT OF SCOPE.** ⛔ **They do not close as "no residue found".** The residue is
  real, measured, and **accepted** — the census stands as the record of what is knowingly
  retained. A future reader must not mistake this for an absence of findings; that
  distinction is the entire reason the census document is kept rather than deleted.
- ⚠ **The platform's erasure claim now rests on a control the platform does not enforce.**
  Training is a process control; the software cannot detect PHI typed into a title. This is
  a legitimate risk-acceptance, and it must be recorded **where the pilot decision is made**
  and not only here — the same requirement Critical FUP C3 carries for its own acceptance.
- ⚠ **`DSR_RESIDUE_NOTICE` line 1 becomes conditionally true rather than structurally true.**
  It tells the data subject *"O descarte apaga os dados do paciente armazenados no banco
  para este registro"*. Under this decision that is true **provided PHI was entered only in
  PHI fields**. The wording is not being changed here — whether it should be scoped to the
  designated fields is a **copy decision for the PO**, filed as
  `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING`. ⛔ Do not treat the notice as falsified; treat its
  premise as newly explicit.
- ⛔ **NOT descoped by this decision, and easy to over-read:**
  - **`FUP-DISPOSE-EVENT-DOOR-GATE-BLIND`** — this is about the door's **authorization
    gate**, not its reach. "Perfect execution of confirmed PHI columns" makes keystoning the
    door that erases `event_patient` *more* load-bearing, not less. Suite
    `352_dispose_event_door_gate.sql` stands.
  - **`FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`** — an operational procedure for the column
    doors is squarely "perfect execution", and remains owed.
  - **Critical FUP C1 (C1a/C1b)** — the disposal rehearsal is unaffected.
  - **`FUP-XREF-PEPPER-ROTATION-ORPHANS`** — unaffected, though ⛔ **not for the reason an
    earlier draft of this ADR gave.** It said *"`patient_xref` is designated PHI"*; the
    catalog says the opposite, in the table's own comment: *"KEY-ONLY … non-reversible keyed
    hashes … NO names, NO raw MRN, so it is **NOT a PHI store** (Rule 12 — this layer adds no
    fourth PHI table)."* The item survives because it is about the **consequence of erasure
    on a derived index** (rotation strands disposed rows whose key can no longer be
    recomputed), not about extending erasure to a free-text column. Same verdict, sound
    reason. *Verify against the catalog, never a sentence about it.*
- ⚠ **One edge this decision does not obviously settle, flagged rather than assumed.** The
  `ethics_*` lane exposed **two** data subjects. Descoping the *patient*-PHI half follows
  directly from this ruling. The other half is the **accused professional**, whose
  allegation text is personal data about them — **Class-2 professional identity** under Rule
  12, a different data class from patient PHI, and a data subject ADR 0130's DSR workflow
  can return `granted` for with no door to call. This ADR is written about **PHI**; whether
  it also rules on Class-2 erasure is the PO's to confirm. Recorded in
  `FUP-ETHICS-LANE-NO-ERASURE-DOOR`'s closure note so the question is not lost inside a
  close. ✅ **CONFIRMED AND RULED 2026-08-21 — ADR
  [0132](./0132-ethics-proceedings-carry-no-erasure-entitlement.md)** (see Amendment 6).
  ⛔ **One clause above is FALSE and 0132 measured it so:** the workflow can *not* "return
  `granted` with no door to call" — `dsr_requests.patient_key` is `NOT NULL` with no
  subject-type column, so a professional-identity request cannot be **intaken**, let alone
  adjudicated. The gap was one stage earlier than three records claimed.

## Rejected

**Widening the doors to their composition closure** (the Amendment 1 method applied to the
remaining three). Measured at 133 candidate columns; each widening carries a migration, a
pgTAP pin per column with its vacuity control, and an ADR amendment — and it erases
institutional governance content (findings, rationales, decisions) whose retention is
itself a regulatory duty. The pilot's value is in doing the confirmed set perfectly.

## Amendment 1 — this ratifies an invariant the architecture already held, and it removes NO backlog item

**2026-08-20, same day.** Written after sweeping the open bugs and follow-ups for items whose
subject is a non-designated column, to see what the narrowing retires.

### ⭐ The "title invariant" predates this decision by two months

The WS B classification (2026-06-20, lead-ruled) annotated the PHI-bearing free-text columns
with SQL column COMMENTs and **explicitly EXCLUDED all `*.title` columns** as *"governance
metadata, PHI-free by the title invariant"*. Verified in the catalog today: **23 columns**
carry a `PHI-BEARING free text` comment and **zero of them are a `title`**.

So this decision is **not a new assumption**. The platform already declared that titles ride
on queue/list paths and stay PHI-free by design; ADR 0131 extends the same reasoning from
titles to free text generally, and makes the compensating control explicit.
⚠ **Consequence for the census:** its `patient_safety_event.title` and `capa_action.title`
findings were measured against a question the architecture had **already answered** in June.
The measurement was sound; their status as *findings* was overstated. Recorded so the census
is read at the right weight rather than re-litigated.

### Nothing is removable; two items change shape and one is PROMOTED

**Removable outright: none.** Every open item whose subject touches a non-designated column
turned out to rest on a second obligation this ADR does not govern.

| item | verdict |
|---|---|
| **WS B — authoritative PHI-bearing free-text column list** (deferred backlog) | ⚠ **NARROWED, not removed.** It serves **two** rules: the Rule 12 *erasure-reach* half is descoped here; the **Rule 11 read-audit** half is untouched (its own text notes the agenda free text is read-audited via `meeting.viewed`, the subject note via `interview.viewed`). ⛔ Removing the item because half of it is descoped would silently drop audit obligations. Its remaining deliverable — aligning ARCHITECTURE.md — must now record these columns as *PHI-capable, read-audited, **not** erased*. |
| **`FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`** | ⚠ **NARROWED.** The procedure is still owed, now scoped to the **designated** columns the doors clear. |
| **WS B/C FE — discourage PHI in `*.title` / short fields** (deferred backlog) | ⭐ **PROMOTED, the opposite of removed.** Soft helper text (*"Não inclua dados do paciente."*) on title inputs is the **only software support for the training control this decision now depends on**, and it defends the very title invariant WS B's exclusion rests on. Cheapest thing that makes the control stick; it should no longer sit in a "not blocking" backlog. |
| `FUP-VACUOUS-COVERAGE-1` — "two PHI-remediation tests that NEVER RUN" | **Unaffected.** Reads as an erasure item; REM-8/REM-9 actually assert **audit emission** (`rca.viewed`, `capa_plan.viewed`) — Rule 11. The *spec file* is named `phi-remediation`; the tests are not about redaction. Checked in the spec, not in the follow-up's summary. |
| `BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE` | **Unaffected** — the dialog fires `dispose_referral_phi`, which erases `referral_patient`, a designated Class-1 module. Squarely "perfect execution". |
| `FUP-E2E-ABSENT-ROW-ASSERTIONS` | **Unaffected, arguably promoted** — its live instances assert that PHI erasure *happened* (`phi_disposed_at`, `audio_deleted_at`, `purged_at`) and pass when the row is absent. Verifying the confirmed set is exactly this decision's priority. |

## Amendment 2 — the compensating control is NOT training alone: a correction corridor exists, is documented to operators, and is BOUNDED

**2026-08-20, same day, prompted by the PO asking whether mechanisms to adjust meeting
minutes were not already being built.** They were, and this ADR understated the platform's
position by naming only the preventive control.

### What exists (measured, catalog + shipped copy)

- **`reopen_meeting` → edit → re-sign is BUILT**, and ADR
  [0130](./0130-dsr-subject-request-workflow.md) **Decision 7** makes it the *sanctioned
  surgical prose-redaction path* (Q10a) — an in-place redaction door was deliberately
  **rejected** in its favour, not merely omitted.
- **Operators are already told the procedure.** `DSR_ATTEST_PROCEDURE_COMMON`
  (`src/lib/dsr/messages.ts`) ships: *"Para remover uma menção em conteúdo já bloqueado:
  reabra a reunião, edite o trecho e assine novamente. A nova revisão invalida as impressões
  já registradas."* — and *"Não existe remoção parcial de conteúdo bloqueado por outro
  caminho."* The corridor is not a theoretical fallback; it is live guidance in the DSR
  workflow.
- **Seven `reopen_*` doors exist** across lanes (`meeting`, `case`, `referral`, `rca`,
  `capa_plan`, `interview`, `triage`), so the corrective pattern is not meeting-specific.

**So the control set is two-layered, and this ADR should have said so:**
**preventive** — training, plus the `*.title` helper text promoted in Amendment 1;
**corrective** — the reopen corridor, for prose that slips through anyway.

### ⛔ But the corridor is bounded, and the bounds matter MORE under this decision

Once free text is out of erasure scope, the corridor becomes the *only* remedy for PHI typed
into it — so its coverage gaps become the platform's exposure. Measured, from ADR 0056
Amendment 1:

1. **Two of the four locked meeting states have NO path at all.** `reopen_meeting` accepts
   only `in_signature` and `signed`; `app.guard_meeting_status`' transition list contains no
   arm whose `old.status` is `distributed` or `cancelled`, and every writer including RPCs
   must satisfy that list. For a **distributed or cancelled** meeting, non-erased free text
   *cannot be changed by any door*.
2. **The operator who may dispose may not be the one who may correct.**
   `dispose_meeting_minutes` gates on `is_staff_admin_of` **OR** `is_tenancy_admin_of`;
   `reopen_meeting` gates on `is_staff_admin_of` **alone**.
3. **It is expensive by design** — reopening revokes every signature, bumps
   `meetings.revision`, and that epoch bump invalidates registered prints (ADR 0126 D9).

⚠ **Only the MEETING corridor has measured bounds.** The other six `reopen_*` doors have
never been analysed for this purpose, and the gate split is not uniform — **2 of 7** mention
`is_staff_admin_of`, so neither bound above may be generalised in either direction. Filed as
`FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED`.

### Consequence

**The residual risk this decision accepts is real but NOT unmitigable — and it is not
uniformly mitigable either.** Most PHI that slips into prose can be removed through the
corridor. For a distributed or cancelled meeting's non-erased columns, it cannot be removed
at all. That is the honest statement of the accepted exposure, and it is what belongs
wherever the pilot risk acceptance is recorded.

⚠ **`FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING` is re-framed, not withdrawn:** the notice's
premise is *training plus a bounded corrective path*, which is a stronger position than the
follow-up was filed under. The copy question stands.

## Amendment 3 — Decision 4 is keyed on SCOPE CLASS, not on working state

**2026-08-20 · PO-ruled, prompted by the `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`
measurement · revises Decision 4 in place (see the (a)/(b)/(c) clauses there).**

### What forced the revision

Decision 4 as originally written — *"already-implemented erasure reach is MAINTAINED, not
rolled back"* — was authored on the assumption that shipped reach **works**. On 2026-08-20 that
assumption was measured false: `app.guard_rca_child_lock`, `app.guard_capa_child_lock` and
`app.guard_interview_child_lock` read no disposal stand-aside, so `dispose_event_phi` aborts on a
`completed` RCA or a `completed`/`cancelled` CAPA plan, and `dispose_case_phi` aborts on a
`completed`/`cancelled` interview. Under the original wording that broken reach was
simultaneously **unfixable-by-removal** (D4 forbids rollback) and **unreachable-by-widening**
(D2 forbids extension) — frozen in a state where it does nothing but fail.

### The rule that was PROPOSED, and why it was not adopted verbatim

The proposal was: *"already-implemented reach that **is working** is MAINTAINED; implemented
reach that is not working is rolled back."* The instinct is right and is adopted as clause (b).
The literal phrasing was not, for three reasons — recorded because each is a way this ADR could
have been made worse by a change that reads as a tightening:

1. ⛔ **It makes a legal entitlement a function of the bug backlog.** "Working" is a *discovered*
   state, not a property. Every newly found defect would automatically narrow what a data
   subject receives — inverting the normal direction, in which a defect creates an obligation to
   fix. It also rewards not looking: this reach was "working" for six weeks in precisely the
   sense that nobody had executed it. [[a-comment-is-an-assertion-that-goes-stale-silently]]
2. ⛔ **It is a one-way ratchet.** Rolled-back reach becomes *unimplemented*, at which point D2
   forbids its return. Reach could then only ever decrease, converging on the minimum without
   anyone ever deciding that outcome.
3. ⛔ **Its trigger is ambiguous in the dangerous direction, on this very case.** What is "not
   working" here is the **`event_patient` DELETE** — Decision 1 Class-1 PHI — which is rolled
   back by a guard firing ~10 statements later (measured: `event_patient` 1 → 1,
   `phi_disposed_at` NULL; control with the RCA `in_progress`, 1 → 0 and stamped). Read
   literally, the proposed rule points at the **mandatory** statement, because it does not
   distinguish the statement that *fails* from the statement that is *failed by*. Clause (a)
   exists to close exactly that reading.

### Consequence — a live PO choice, NOT decided here

Clause (b) makes the RCA / CAPA / interview free-text redaction **eligible** for rollback. It
does not roll it back. Two paths now exist for `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`:

- **Fix the guards** (ADR [0129](./0129-meeting-child-lock-disposal-flag.md) shape 2, repeated
  per lane): extend `app.in_disposal_rpc` to the three child locks. Preserves the shipped reach.
  ⚠ Cost, stated fairly: each stand-aside is a real erosion of the immutability those guards
  provide, and 0129 rejected the wider shape for that reason. Three more is not free.
- **Roll back under (b)**: delete the guard-tripping statements — the **five** `rca_*` child
  UPDATEs and **three** `capa_*` child UPDATEs in `dispose_event_phi`, and the **one**
  `case_interview_subjects.note` UPDATE in `dispose_case_phi`. Nine statements. The parent-row
  redactions (`rca.*_md`, `patient_safety_event.description_md`,
  `event_triage.disposition_notes_md`, `case_interviews.summary_md`) are **not** implicated —
  their guards already honour the doors' flags — so they may stay regardless.

⭐ **Either path resolves the P0, and that is the point of clause (a):** the in-scope
`event_patient` / `patient_identifiers` erasure must work whichever is chosen. Under (b) the
residue to be named is the nine columns' free text, which joins the census as knowingly
retained; under the fix it is nothing. ⛔ Do not read this amendment as authorising the rollback
— clause (c) requires the ruling to be recorded per lane, with the residue named.

## Amendment 4 — the choice is taken (FIX, not rollback), and Amendment 3's own magnitude was wrong

**2026-08-20 · PO-ruled, same day · closes the live choice Amendment 3 left open.**

### The ruling

⭐ **FIX THE GUARDS.** ADR [0129](./0129-meeting-child-lock-disposal-flag.md) Decision 1 — *shape 2,
a new narrow flag* — repeated per lane, exactly as ADR 0129 Amendment 2 prescribes: extend
`app.in_disposal_rpc` (still set **only by disposal doors**) to the sibling child locks. Clause
**(b)**'s rollback of the out-of-scope free-text reach was **considered and declined**.

⛔ **This is therefore NOT a rollback, and must never be recorded as one.** Clause (b) makes that
reach *eligible*; the PO did not exercise it. Decision 4's default — *maintained, not rolled back* —
stands, the census gains nothing, and no per-lane residue statement is owed under clause (c).

Consequences of choosing the fix over the rollback, stated so the cost is on the record:
- The setter count for `app.in_disposal_rpc` goes **1 → 3**, all three disposal doors. ⛔ ADR 0129
  Amendment 1's invariant is what keeps this safe and it must be restated rather than assumed:
  *"it was never 'exactly one guard reads the flag' — it is **only the disposal door bypasses the
  child lock**, and **the setter count is what bounds the bypass**."* A non-disposal door setting
  this flag would void the guarantee.
- Three more stand-asides are a real erosion of the immutability those guards provide. Amendment 3
  said *"three more is not free"*, and that remains true after the ruling; it was weighed, not
  waived. Shape 1 — teaching a guard to honour the lane's own `app.in_*_rpc` flag — **stays
  rejected**, because it would grant every lane RPC child-write power over locked parents.

### ⛔ Amendment 3 named NINE statements and THREE guards. It is TEN and FOUR.

Re-derived from the live catalog and confirmed by execution on 2026-08-20, before any fix was
written. The tenth appears in **no** filed record — not in `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`,
not in Amendment 3, not in the corridor measurement that produced both.

**`dispose_case_phi` statement #13 — `update public.meeting_cases set summary = …, decision = …` —
is guarded by `app.guard_meeting_child_lock` and aborts on `meetings.status in ('in_signature',
'signed', 'distributed', 'cancelled')` with `23514`.**

⭐ It is the cheapest of the ten and needs **no guard change at all**: `guard_meeting_child_lock`
**already reads** `app.in_disposal_rpc` — this ADR's own Amendment 3 template gave it that
stand-aside in ADR 0129. `dispose_case_phi` simply never sets the flag. What it *does* set is
`app.in_meeting_rpc`, carrying the inline comment `-- for meeting_cases child-lock`, which is
**false against the live guard**. [[a-comment-is-an-assertion-that-goes-stale-silently]]

Executed differential, single session, rolled back, pre-state re-verified byte-for-byte:

| probe | setup | GUCs | result |
|---|---|---|---|
| A | meeting walked `held→in_signature→signed` | `dispose_case_phi`'s exact set — `in_case_rpc`, `in_narrative_rpc`, `in_interview_rpc`, `in_submit_rpc`, `in_meeting_rpc` | ⛔ `ERROR: o conteúdo desta reunião está bloqueado (signed)` — `guard_meeting_child_lock` |
| B | identical | A **plus** `app.in_disposal_rpc = 'on'` | ✅ `UPDATE 1` |

### Why the miss matters more than the arithmetic

⛔ **Amendment 3 was authored while correcting a magnitude, and got the magnitude wrong.** Its whole
subject is that Decision 4 must be keyed on scope class rather than on discovered working state —
sound, and adopted — but the enumeration it carried into the fix was a **hand list inherited from the
bug report**, not a property re-derived from the catalog. That is the same shape the bug it was
written about had: ADR 0129 swept the sibling axis *"which DOOR is gate-blind?"* and never
*"which GUARD lacks the stand-aside?"*.

⭐ **The lesson generalises past this ADR:** a correction that fixes a claim's *direction* without
re-deriving its *magnitude* reads as complete and is not.
[[a-partial-fix-reads-as-a-complete-one]] · [[enumeration-boundary-is-a-syntax-not-a-property]]

**Binding consequence for the implementing change:** the guard population is re-derived **as a
property over the catalog** — each door's write set × every row-level trigger on those tables that
can `raise` × the trigger's `TG_OP` mask — with a recorded verdict per row (CONFIRMED-reachable /
STRUCTURALLY-UNREACHABLE / NON-BLOCKING). ⛔ A candidate count is not a defect count; an unproven row
is not a clean row either.

### Two further rulings taken at the same time

- **`DSR_RESIDUE_NOTICE` line 1 stays as written**, on the training premise
  (`FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING` closes). ⛔ The premise is therefore load-bearing and is
  recorded **where the pilot decision is made** —
  [dm5-po-decisions.md](../progress/dm5-po-decisions.md) § *Remaining pre-pilot work* item 2 — as
  this ADR's Consequences require, and not only here.
- ⛔ **REVERSED THE SAME DAY — see Amendment 5. Do not act on this bullet.** It read *"the referral
  dispose dialog is made REACHABLE rather than removed or accepted as a gap"*, and flagged as open
  the very question that overturned it: whether a **production** hat can hold route access **and**
  the disposal gate without a hat switch. The answer is **no**. Kept rather than edited away,
  because the ruling was sound on the facts it was given and it is the *facts* that moved.

⛔ **Still not ruled by this ADR, and still the PO's:** Class-2 professional-identity erasure for the
`ethics_*` lane's second data subject. Amendment 3 flagged it; Amendment 4 does not resolve it.
✅ **RULED 2026-08-21 — ADR [0132](./0132-ethics-proceedings-carry-no-erasure-entitlement.md).** See
Amendment 6 at the foot of this ADR.

## Amendment 5 — the referral-dialog ruling is REVERSED, and the go-live flip is authorised

**2026-08-21 · PO-ruled · written after QA returned CHANGES REQUESTED on the remediation round, with
blockers C1 and C3 naming exactly the two records this amendment supplies.**

### 1. Amendment 4's referral-dialog bullet is reversed: REMOVE, not "make reachable"

Amendment 4 ruled *"the referral dispose dialog is made REACHABLE"* and, in the same sentence,
flagged as open the question that overturned it. Measured 2026-08-20 and verified independently:

| requirement | admissible active hats |
|---|---|
| reach `/o/[org]/c/[commission]/encaminhamentos/[referralId]` | `staff` · `staff_admin` |
| pass `can_dispose_referral_phi` | `org_admin` · `hospital_admin` · `nsp_coordinator` · `pqs_member` |

**Disjoint.** `getSessionContext()` hat-filters grants to `g.role === activeRole` *before*
`partitionGrants`, which admits only `staff`/`staff_admin` into `memberships`; every arm of the
dispose predicate bottoms out in `app.has_role`'s active-hat conjunct. One session, one hat ⇒ **no
persona satisfies both, in production or in the seed.** It was a **PRODUCT** gap, not a fixture gap,
and no `seed.sql` row could have closed it.

⭐ **The measurement that settled it:** for the candidate persona **all four DB gates returned TRUE**
and the page still **404'd**. Four green predicates and a dead route is the signature of a filter
above the database — and the wrong first answer came from reading `public.session_context()`, which
*is* hat-blind by design (ADR 0106 D9), and inferring the route's behaviour from it. **The SQL was
truth about the SQL and evidence about nothing downstream.**

**Ruling: REMOVE the affordance from the referral detail page.** The DSR task inbox already reaches
`dispose_referral_phi` for exactly the hats that hold the gate, and is in fact the only working UI
path to all four erasure doors — which is ADR [0130](./0130-dsr-subject-request-workflow.md) **D11**'s
own design (*"one inbox"*). ⛔ **Nothing is lost:** no hat could open the removed dialog. What is
removed is UI that reads as a capability the product does not have — the misreading that produced
`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE` in the first place.

⛔ **Two things this ruling deliberately does NOT do**, because either would trade a UI gap for a
real authorization widening: it does **not** add a source-commission `staff_admin` arm to
`can_dispose_referral_phi` (whose own documentation says a plain `staff_admin` is *intentionally* not
entitled, PHI erasure being an org-admin / NSP action), and it does **not** carve an exception in
QO·B's content wall (ADR 0100 D12).

⚠ **Residue, named rather than absorbed:** `dispose_referral_phi` is now the **only** one of the four
lanes with no browser-level coverage on the surface that can reach it
(`FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE`). ⛔ The bug it descends from closed **on
removal of its subject, not on achieved coverage**, and that distinction must survive any future
summary of this ADR.

### 2. The `dsr` go-live flip is authorised — and this is where that fact lives

**Ruled 2026-08-20; recorded 2026-08-21.** The `dsr` flag was inserted `false` by
`20261001000000` and the only writer that ever set it true was `supabase/seed.sql`, so **on the
deployed project the entire module was unreachable** — every door raising `HCDS1`, the hospital
lister returning `'[]'`, `/o/[org]/titulares` 404ing for every persona including the appointed
Encarregado, while local and E2E were green throughout because the seed path hid it.

**Ruling: flip it, in its own migration, ordered AFTER the erasure fix.** Shipped as
`20261003000200`; ordering verified in `schema_migrations`. The ordering is the guarantee, not
cosmetics: making the module reachable first would have handed an executor a working button that
silently accomplishes nothing on a `completed` RCA, a `completed`/`cancelled` CAPA plan, a terminal
interview, or a locked meeting's case notes.

- **Platform-wide, and not by preference** — `app.feature_flags` is keyed by feature alone with **no
  tenant dimension**; per-tenant enablement is a schema change, offered and not taken.
- **Critical FUP C1b does not gate it, and they are disjoint mechanisms** — C1b rehearses the
  **Storage-bytes** runbook; these doors erase **columns**. ⛔ Disjoint is not unrelated: C1b's own
  trigger is *before any real patient record is loaded*, and a reachable console on a tenant holding
  real PHI with no rehearsed byte-disposal path is a state to enter deliberately. **The flip does not
  create it; the push plus real data would.**
- ⛔ **The PUSH is a separate decision and has NOT been taken.** Nothing is pushed, no `db push` has
  run, the deployed project is unchanged.

### ⛔ Why this amendment exists at all, stated plainly

**Both rulings were taken on 2026-08-20 and neither was written down.** The referral reversal lived
only in a chat exchange; the flip's authorization lived only in **comment text inside the migration
it authorized**. QA searched the plan, `dm5-po-decisions.md`, PROGRESS.md, three ADRs and
`backend-state.md`, found neither, and returned **CHANGES REQUESTED** — correctly, because a
decision witnessed only by the artifact it authorizes cannot be checked against anything.

⭐ **The engineering was right the whole time; what was missing was the fact that someone was allowed
to do it.** That is a lead defect, not an implementer one, and it is the same class as
[[an-approvals-scope-is-a-fact-that-must-be-written-down]] — an approval's existence and scope are
facts, and a fact nobody recorded is indistinguishable from one nobody had.

## Amendment 6 — the reserved Class-2 question is RULED (ADR 0132), on a basis this ADR does not use

**2026-08-21 · PO-ruled · closes the one item Amendments 3, 4 and the
`FUP-ETHICS-LANE-NO-ERASURE-DOOR` closure note each deliberately left open.**

ADR [0132](./0132-ethics-proceedings-carry-no-erasure-entitlement.md): **an ethics proceeding
carries no erasure entitlement at any stage**, because it is an administrative process with
possible legal consequences and the record *is* the evidence of due process. No door and no UI
will be built; the absence is now a decision rather than a gap.

⭐ **Read the two rulings as independent, not as one restated.** This ADR descopes the lane on a
**reach** bound (it holds no *designated* PHI field). 0132 descopes it on an **entitlement**
bound (no grant is available to execute). ⛔ They are not redundant: this ADR's bound would
evaporate the day a designated PHI column is added to an `ethics_*` table; 0132's would not.

**What 0132 changes about this ADR, precisely:**

- Decision 2's ruling on the lane is **unchanged and unweakened**; it simply is no longer the
  only thing holding it.
- Decision 1's Class-1 obligation is **untouched** — 0132 was scoped by the PO to the
  proceeding record and the respondent professional, explicitly **not** to patient PHI on an
  ethics-*typed* case. `dispose_case_phi` keeps erasing `patient_identifiers` / `answers` there.
- The Consequences bullet quoted above had a **false clause**, corrected in place: the DSR
  workflow cannot return `granted` for a professional-identity request, because it cannot
  intake one.
- ⚠ **Two live doors DO remove ethics-evaluation data**, both pre-existing and neither from the
  DSR program — a `cases` DELETE that cascades all seven tables, and
  `redact_professional_profile` on an undecided case. Enumerated with their measurements in
  0132; **PO-ruled record-only**, so they are *accepted and open*, not fixed and not absent.
