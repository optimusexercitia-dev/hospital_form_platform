# ADR 0130 — DSR workflow: data-subject requests as adjudicated cases, not an erase button

**Status:** **Accepted 2026-08-20 — PO instruction, implementation authorized** (design
PO-ratified 2026-08-19, sixteen decisions in a structured design session; the original
"nothing may be built" hold is **lifted**, see Amendment 2 for what Slice 2 builds and the
three shape changes measurement forced) · **Date:** 2026-08-19 · **Feature:** LGPD Art. 18 request intake /
adjudication / execution ("Direitos do Titular") · **Plan:**
[docs/plans/dsr-workflow-plan.md](../plans/dsr-workflow-plan.md) · **Relates:** ADR
[0035](./0035-lgpd-anvisa-regulatory-posture.md) (+ its Amendment 1 — counsel's retention
ruling), ADR [0056](./0056-phi-disposal-closure-narrowed-claim.md) (the disposal doors +
narrowed claim), ADR [0129](./0129-meeting-child-lock-disposal-flag.md) (prerequisite
fix), ADR [0061](./0061-administrativo-delegated-role.md) (capability-grant
precedent), Rule 12.

> ## ✅ AMENDMENT 1 (2026-08-19, same day) — counsel's return SETTLES the refusal guidance; adjudication gains a recorded legal-consultation reference
>
> The Q14 scope return arrived (holdings quoted in ADR
> [0035](./0035-lgpd-anvisa-regulatory-posture.md) Amendment 1): committee documentation is
> the *analysis of* a prontuário and **not part of it**, so CFM 1821/2007 does not attach
> directly; removal requests are decided **case by case, together with legal consultation**
> (⭐ this supersedes the blanket retention-overrides-erasure framing — Context below reads
> through this); the **20-year retention period is adopted by default as institutional
> policy**. What this settles, against the items Decision 1 left open:
>
> 1. **Default adjudication stance:** records are held under the 20-year **institutional
>    policy default**; a removal request is never auto-refused and never auto-granted —
>    each is adjudicated with counsel. The workflow shape (Q1a) is thereby *mandated*, not
>    merely chosen.
> 2. **`refused_retention` basis language** cites the institutional retention policy
>    (20-year default, adopted per counsel 2026-08-19), **never CFM 1821/2007 directly** —
>    counsel has held that statute does not cover these records, and citing it would be a
>    false legal basis delivered to a data subject.
> 3. **The record gains one field:** `dsr_requests.legal_consultation_ref` (text — date +
>    counsel reference; **required** for `granted` / `granted_partial` / `refused_retention`
>    outcomes, optional for `refused_identity` / `withdrawn`, CHECK-enforced). Holding 2
>    makes the consultation part of every substantive adjudication; an unrecorded
>    consultation is the approval-without-written-scope failure this program already paid
>    for once. ✅ **CONFIRMED BY THE PO at the Slice 1 kickoff, 2026-08-19: the split stands
>    exactly as drafted** — NOT NULL for `granted` / `granted_partial` / `refused_retention`,
>    optional for `refused_identity` / `withdrawn`. Rationale recorded so the CHECK is not
>    re-litigated when it is written: counsel's holding 2 makes consultation part of every
>    **substantive** adjudication, while an identity failure or a withdrawal never reaches the
>    merits. This was the one open item gating Slice 2's migration; **it is closed.**
> 4. **The `subject_request` lane is live** (no longer contingently closed): the dispose
>    dialog's Art. 18 reason option is valid; `FUP-DISPOSE-DIALOG-OVERCLAIM` reduces to the
>    over-claim alone.
>
> Nothing else in this ADR moves. Status stays **Proposed**; implementation still waits.

> ## ✅ AMENDMENT 2 (2026-08-20) — Status → Accepted; four shape changes measurement forced on Slice 2
>
> The PO lifted the hold and authorized implementation. Building Slice 2 against the live
> catalog moved four things. Each is recorded here because each contradicts a sentence
> written above or in the plan, and a plan that disagrees with the ADR is how a wrong
> shape gets built twice.
>
> 1. **The `dpo` capability grant moves from Slice 3 to Slice 2.** `create_dsr_request` is
>    DPO-gated by Decision 2, and `app.is_dpo_of` **did not exist** (measured 2026-08-20).
>    Gating Slice 2's door on a placeholder and replacing it in Slice 3 would change a live
>    authorization gate **twice**, each change owing its own ADR-0079 sweep. Pulling the
>    grant forward is strictly less gate churn. ⛔ **The one named widening (Decision 3 —
>    `search_patient_xref` gains an `is_dpo_of` arm) does NOT move**: Slice 2 needs no
>    patient search, because `create_dsr_request` derives `patient_key` itself.
> 2. **`complete_dsr_task` verifies the EFFECT, not a mirrored gate.** The plan drafted it
>    as "requires the task's own door-gate predicate to pass for the caller". The four
>    disposal gates are four *different* expressions (measured); a fifth copy of each would
>    be a mirror with no gate able to keep it in sync — and a gate that silently stops
>    matching its original is the stale-mirror family this program has already paid for.
>    Instead, for a `dispose_*` task the door reads **the module row's own
>    `phi_disposed_at`** — measured present on all four module tables (`cases`,
>    `patient_safety_event`, `case_referral`, `meetings`). That is *strictly stronger*: it
>    proves the disposal **happened**, where the drafted shape only proved the caller could
>    have done it. The caller must still be able to **see** the task (the routing
>    predicate). Decision 2's binding constraint — the DSR never fires a door — is
>    unchanged, and is now structural rather than promised.
> 3. **The fan-out does NOT mint `dispose_meeting` tasks.** `meeting_cases` does link
>    meetings to cases (measured), so a mechanical link exists — but `dispose_meeting_minutes`
>    erases the **whole** minutes (the minutes text plus every agenda item's
>    `description`/`discussion_notes`/`resolution`). Minting it because one agenda item
>    touched the subject's case would destroy other committees' unrelated records. The
>    fan-out mints an **`attest_review`** task per linked meeting instead, whose procedure is
>    the Q10a revoke corridor. `dispose_meeting` stays in the kind enum for **adjudication
>    (Slice 3)** to mint deliberately. ⛔ Consequence, stated so it is not read as an
>    oversight: **ADR [0056](./0056-phi-disposal-closure-narrowed-claim.md) Consequence (a)'s
>    missing meetings-dispose UI is discharged in Slice 3, not Slice 2** — shipping the
>    affordance now would ship a door nothing can reach.
> 4. **An unroutable xref row is loud.** `patient_xref.commission_id` is nullable; such a row
>    has no hospital and so belongs to no controller. `create_dsr_request` **raises**
>    (`HCDSR`) rather than silently omitting it — an enumeration that quietly drops a member
>    of its own population is the wrong-grain failure, and a DSR's whole value is the
>    completeness of that enumeration.
> 5. **Two console listers, and NOT a policy arm.** `hospitals_select` admits platform_admin,
>    org_admin, hospital_admin, nsp_org_admin and quality_reviewer — **and nobody else**
>    (measured). The Encarregado is a plain committee member *by design* (Decision 2), so they
>    cannot read the name of the hospital they serve, and neither can a PQS executor holding a
>    routed task. Two shapes were available: add `or app.is_dpo_of(id)` to `hospitals_select` —
>    a **second** widening in a program whose ADR names exactly one — or a DEFINER lister
>    returning only the caller's OWN hospitals, which is what this codebase already does for
>    exactly this need (`list_my_nsp_hospitals`, ADR 0052). **The lister.** No shared table's
>    read boundary moves. A second lister, `list_my_executable_dsr_tasks`, answers "may I ACT
>    here?" — because `dsr_tasks_select` lets the Encarregado SEE every task of their hospital
>    (they must watch the work) while they can execute none, and the inbox was offering them an
>    "Executar descarte" button the module door would refuse. ⚠ Both listers call the SAME
>    predicates the RLS policies call — one definition, not a copy — so neither can report
>    anything the caller could not already read.
>    ⛔ **The console also gets a sidebar entry**, gated on the same lister. A console nothing
>    links to is a door nothing can reach, and both principals (Encarregado, executor) land on
>    their commission — the identical dual-hat problem the NSP and quality-office entries beside
>    it were added to solve.

> ## ✅ AMENDMENT 3 (2026-08-20) — Slice 3 built; six shape changes measurement forced, and two live defects found in passing
>
> Same discipline as Amendment 2: each item below contradicts a sentence written above or
> in the plan, and a plan that disagrees with its ADR is how a wrong shape gets built twice.
>
> 1. ⭐ **`adjudicated` WAS UNREACHABLE — the lane was a fiction.** `complete_dsr_task`
>    advanced `open → executing` **directly** (measured), so no writer ever produced the
>    middle state, and Slice 2's `status` CHECK admitted a value nothing could reach. The
>    new `adjudicate_dsr_request` door produces it, and the advance now covers
>    `status in ('open','adjudicated')`. ⚠ Believing the CHECK constraint would have said
>    the lane already existed.
> 2. **Close CONSUMES the decision; the direct path survives only for outcomes that erase
>    nothing.** `adjudicate_dsr_request` is the sole writer of `outcome` / `outcome_basis` /
>    `legal_consultation_ref`; re-adjudication is refused. `close_dsr_request`'s `p_outcome`
>    becomes OPTIONAL, and a supplied one must MATCH (`HCDS5`) or close would be a second,
>    unstamped author of the decision. **The rule:** *close may record a decision directly
>    only when the decision erases nothing* — `granted`/`granted_partial` require the prior
>    adjudication, because adjudication is where the erasure population (including the
>    meeting escalations) is finalized. ⚠ The three non-erasing outcomes still **stamp**
>    `adjudicated_at`/`_by`: `refused_retention` requires a legal consultation by CHECK, so
>    it IS a substantive adjudication under Amendment 1 / ADR 0035 Amdt 1 holding 2, and a
>    null stamp on a closed request would say a decision made with counsel was never taken.
> 3. **`status` is the WORK state; `adjudicated_at` is the DECISION fact.** A request whose
>    execution began before the decision stays `executing` and still records it. Reporting
>    it as `adjudicated` would read as a regression of work that happened.
> 4. **⛔ The `dispose_meeting` escalation is EXPLICIT, per meeting, and bounded by its own
>    request** — not automatic on a `granted` outcome. Minting it mechanically would
>    re-introduce exactly the over-broad erasure Amendment 2 item 3 refused to automate.
>    `adjudicate_dsr_request` takes an explicit `p_dispose_meeting_ids uuid[]`; a meeting
>    the census never enumerated is refused `HCDS2` (so the door's reach is its own request,
>    not the hospital), a non-granting outcome `HCDS5`, an already-disposed ata `HCDS5`.
> 5. **The attested tier's population is NARROWER than the plan said, and the plan's own
>    words were right about what remains.** Measured from `dispose_case_phi`'s live body: it
>    already erases `case_narratives.body_md`, `case_events`, `case_interviews`, case-phase
>    `answers`, case-homed `documents` and `meeting_cases.summary/decision`. So **two of the
>    three named attested-tier populations ("narratives", case-linked responses) are
>    MECHANICAL**, not attested. What genuinely has no signal is meeting minutes prose
>    (already minted per linked meeting) plus **non-case form responses and assorted
>    per-commission free text** — so the fan-out now mints one `attest_review` per commission
>    of the hospital **that holds such prose** (a measured predicate, not a guess). Without
>    it the outcome record reports "attested: 0" forever and the two-tier claim is false in
>    the direction this program exists to fix.
> 6. **Attestation gets its OWN door, and `complete_dsr_task` refuses the kind.** A named
>    reviewer plus a redaction count are required (`attest_dsr_task`), because an optional
>    structured tier is an unreliable one and the outcome record cannot state a count nobody
>    was obliged to give. `0` is a real, required answer — "I looked and found nothing" —
>    where NULL is "nobody said". ⛔ Decision 7 is untouched: no in-place redaction door
>    exists; the procedure is the revoke corridor, and it is now **carried in the task**.
>
> **Two live defects found while building, both fixed here, neither this slice's subject:**
> (a) `app.patient_trajectory_bundle` computed the **case** entry's display code as
> `cases.id = <a patient_participants id>` — the Slice-2 grain — so it rendered `—` for every
> case, always, in the PQS console as well. Display-only, no pin asserted it, fixed in the
> same migration because this slice puts that bundle in front of the Encarregado at intake.
> (b) `complete_dsr_task` **overwrote `dsr_tasks.note`** — the column the fan-out uses to
> carry the revoke-corridor procedure — destroying the instructions at the moment they were
> being followed. `note` is now the immutable minted PROCEDURE; `completion_note` is what the
> human wrote.
>
> 7. ⭐ **A REFUSAL RETIRES ITS OUTSTANDING WORK — and the asymmetry that makes it
>    necessary is deliberate.** `close_dsr_request` counts pending tasks only for
>    `granted` / `granted_partial`, which is correct and stays: demanding the
>    disposal tasks be `done` before a REFUSAL close would force the executor to
>    erase exactly the data the adjudication just decided to retain. But measured
>    after a `refused_retention` close, **all six tasks stayed `pending` and the
>    executor was still offered six executable tasks, three of them PHI erasures**.
>    The workflow was instructing the opposite of its own decision, and it failed
>    **OPEN against a decision to retain** — in a program whose entire subject is
>    adjudicated retention. Non-granting closes now set those tasks to `blocked`,
>    and both completion doors refuse the value.
>    ⚠ **`blocked` is REUSED, not minted** — the enum has admitted it since Slice 2
>    with nothing writing it. That avoids a new value, but the word's plain reading
>    ("cannot proceed yet") is the WRONG one here: these are retired by decision.
>
>    > ⛔ **CORRECTION (QA r2) — this item previously said the distinction "lives
>    > one join away in `dsr_requests`" and that *"any surface showing a blocked
>    > task must resolve that join and say why"*. THAT WENT LIVE-FALSE INSIDE THIS
>    > SAME AMENDMENT.** Item 7's own M2 change gave `blocked` a **second writer**:
>    > an escalated meeting disposal retires that meeting's attestation while the
>    > request is **open and `granted`**. Resolving the join and "saying why" on
>    > that path produces a **false statement** — it reports a decision that
>    > refused erasure when the decision in fact ordered a *fuller* one.
>    >
>    > **The rule that actually holds, and that all six code sites implement:**
>    > ⛔ *no surface may name the cause of a retirement from `status` alone.*
>    > `dsr_tasks` cannot distinguish the two writers, and the stamped-reason column
>    > that would is deliberately **out of this slice**.
>    >
>    > ⭐ **Cause-neutral copy is not tidier — it is the only thing that stays
>    > true.** The instruction to resolve the join was written when there was one
>    > writer, and adding the second falsified it without touching it. Five strings
>    > across two layers went false the same way; this ADR sentence was the sixth.
>
>    ⛔ Writing a value nothing wrote before
>    can break readers that were correct when the old domain was the whole domain,
>    silently — so the readers were swept first, asking "what does this DO when it
>    meets `blocked`?". Three SQL readers needed fixing (`complete_dsr_task`,
>    `attest_dsr_task`, `list_my_executable_dsr_tasks` — the last had **no status
>    filter at all**), and `getDsrOutcomeRecord` gained a `retired` count because a
>    retired task counted as neither disposed nor pending and `total` had stopped
>    equalling its parts.
>
>    > ⛔ **CORRECTION (QA r1). This item previously claimed "all nine SQL readers
>    > plus the TS and UI readers were swept". THAT WAS FALSE, and it is corrected
>    > rather than softened, because an ADR that says a sweep is done is how the
>    > next reader stops looking.**
>    >
>    > **What the sweep actually covered:** the nine SQL readers, enumerated from
>    > `pg_proc` — that half was exhaustive and is the half the migration header
>    > lists. Plus **two** TS readers found by reading the query layer.
>    >
>    > **What it did NOT cover: the rendering surfaces.** It reached
>    > `src/lib/queries/**` and stopped. Four readers were missed there, none of
>    > them by me — three by `frontend` (`isDone`, the panel's `outstanding` count,
>    > and the minted procedure note still printing the revoke corridor on a
>    > retired card) and a fourth by QA: `dsr-request-panel.tsx` computing
>    > `done = totalTasks - pendingTasks`, which put a retired task in the DONE
>    > bucket by subtraction and rendered **"6/6 tarefas concluídas"** beside
>    > "Recusada — retenção" — six PHI erasures asserted as carried out when zero
>    > were.
>    >
>    > ⚠ **The generalisable part.** A newly-writable enum value leaves every
>    > downstream reader **unexercised by construction** — no environment had ever
>    > rendered `blocked`. A catalog sweep closes the SQL half completely and is
>    > structurally blind to the render half; only executing the new state finds
>    > those. Three of the four were found in a browser, one by reading a
>    > component. **Neither the sweep nor this ADR should be read as covering
>    > surfaces.**
>
> ⚠ **And one over-grant the author committed and an existing pin caught.** The house idiom
> `revoke from public, anon; grant to authenticated, service_role` was applied by reflex to
> `app.patient_trajectory_bundle` — the RAW, UNGATED PHI assembler, deliberately
> **service_role-only**. Suite `152` §M1 went red and named it. `CREATE OR REPLACE FUNCTION`
> does **not** reset an ACL: when rewriting a body, leave the grants alone or diff the ACL
> from the catalog *before* writing the grant line. "Every new function needs an explicit
> grant" is a rule about NEW functions.

> ## ✅ AMENDMENT 4 (2026-08-20) — Decision 9's notification-scrubbing premise is FALSIFIED; the residue class it names does not exist
>
> Slice 4 opened by measuring what Decision 9 (Q12a) assumed. **The assumption is wrong in
> three independent ways and the scrub it mandates is not constructible.** Recorded here
> rather than dropped quietly from the plan, because Decision 9 is the sentence a future
> session would rebuild from.
>
> 1. ⭐ **Three of the four doors' subjects cannot be NAMED in `notifications`.**
>    `notifications.entity_type` is CHECK-constrained to eight values — `capa_action`,
>    `response_section_signoff`, `meeting`, `action_item`, `ethics_notification`,
>    `commission`, `controlled_document`, `controlled_document_version`. **`case`,
>    `referral` and `event` are not among them.** Decision 9's predicate (`by
>    entity_type, entity_id`) therefore matches **zero rows by construction** for
>    `dispose_case_phi`, `dispose_referral_phi` and `dispose_event_phi` — and a pgTAP pin
>    on a scrub whose population is empty **by CHECK constraint** is vacuous in the
>    strongest available sense: it cannot fail, for any code, ever.
>    ⚠ Verified by **constructing the state**, not by reading the constraint: inserts of
>    `entity_type='case'` and `='referral'` were each **refused**, with a `'meeting'`
>    insert as the positive control proving the probe itself could succeed.
>
> 2. **The cited evidence is false.** `FUP-NOTIFICATIONS-PHI-RESIDUE` argued that ADR 0056
>    "redacts `cases.label` *because* it is PHI-warned — but every notification that label
>    ever generated keeps the pre-redaction text." Measured against the catalog:
>    **no notification writer ever reads `cases.label`.** There is exactly one writer
>    (`app.enqueue_notification`, the sole `insert into notifications` in the catalog) and
>    sixteen callers; not one reads a case label. The residue described has never existed.
>    ⚠ The writer set is **bounded, not merely enumerated**: `notifications` carries
>    SELECT/UPDATE policies only, and **no INSERT privilege is granted to
>    `authenticated` at any grain** — table, column, or via role inheritance — so no
>    caller can insert except through that DEFINER. ⚠ "granted", not "grantable": the
>    owner may grant it at any time, and the measured fact is the weaker, true one about
>    the privileges that exist now.
>    There is no TS-layer insert.
>    ⛔ **CORRECTION (QA r1) — this sentence first read "grants `authenticated` `r` alone",
>    and that was FALSE.** The *table* ACL is `authenticated=r`, but a **column-level**
>    grant sits beside it that `pg_class.relacl` does not show:
>    `pg_attribute.attacl` carries `read_at = authenticated=w`, which is how the INVOKER
>    `mark_notification_read` works. `authenticated` **can** UPDATE this table. The
>    conclusion is unchanged — the write privilege is scoped to `read_at`, and `title`/`body`
>    remain unwritable (constructed and rolled back: title UPDATE **denied**, `read_at`
>    UPDATE **allowed**) — but the *stated reason* was wrong in a security record.
>    ⭐ **The generalisable part: a table ACL is not the privilege census.** `relacl` and
>    `attacl` are different catalogs, and a column grant is invisible in the one everybody
>    reads. This is the same blindness that has bitten this project before, and it appeared
>    here in the very sentence claiming the enumeration was *bounded*. **`attacl` belongs
>    beside `relacl`, exactly as `prosecdef` belongs beside `pg_policies`.**
>
> 3. ⛔ **NOT ONE notification text source is erased by any dispose door.** The full
>    title/body source census: `capa_action.title` · `meetings.title` ·
>    `action_items.title` · a form-section title · `controlled_documents.title`/`.code` ·
>    the commission name (commented PHI-free by Rule 12) · and the ethics body, which is
>    `ethics_notifications.notification_type` — a **CHECK-constrained enum of eight
>    values**, PHI-free by construction. Cross-referenced against all four door bodies:
>    **zero overlap.** So even for `meeting` — the one representable subject — a scrub
>    would erase copy whose source the door **deliberately leaves intact**:
>    `dispose_meeting_minutes` nulls `minutes_md` and redacts agenda items, and never
>    touches `meetings.title`.
>
> ⭐ **The generalisable part, and why it is a different error from Amendment 3's.**
> Decision 9 called this residue class "cheap and mechanical". It was neither — it was
> **absent**, and every word of the design was internally coherent. The premise was written
> from the *column names* (`entity_type`, `entity_id`, `title`, `body`), which read exactly
> like a polymorphic handle to the disposed entity. Only the **writers** say what the key
> points at, and one of them — `compute_due_ethics_notifications` — stores a **`cases.id`
> under `entity_type = 'ethics_notification'`**, which is neither the entity the column
> name suggests nor a type the domain admits for cases. *A predicate read off a column name
> is a guess wearing a schema's authority.*
>
> **Decision 9 is amended:** the notification-scrubbing clause is **WITHDRAWN**. The
> fixed residue-language clause **stands unchanged** and has shipped as
> `DSR_RESIDUE_NOTICE`. `FUP-NOTIFICATIONS-PHI-RESIDUE` closes as premise-falsified.
>
> ⚠ **What the measurement DID surface, filed rather than folded in silently**
> (`FUP-DOOR-ERASURE-FREETEXT-CENSUS`): `capa_plan.source_event_id` references
> `patient_safety_event` directly, and `dispose_event_phi` erases the **grandchild**
> `capa_action_task.description` while leaving the **child** `capa_action.title`
> (`text not null`, operator free text) intact. The real question was never the
> notification copy — it is whether each door erases every free-text column on its own
> lane. That is a column census **of the doors**, not of `notifications`, and it is the
> method this program has twice credited: reading a door tells you what it redacts; only
> reading the tables tells you what it does not.

## Context

The platform has four patient-PHI disposal doors and no *process* around them: no way to
record that a request arrived, no adjudication, no refusal path (Art. 18 §4 requires the
controller to answer a declined request with its legal basis), and — per pilot-gate check
item 0 (`FUP-ACT-DISPOSE-UI`) — no persona who can both reach a dispose affordance and
pass its gate. Counsel has ruled (reported by the PO 2026-08-19; recorded with its scope
question in ADR 0035 Amendment 1) that the 20-year retention duty **overrides** Art. 18
erasure — which makes a **documented refusal** the *normal* outcome of a request and
erasure the exception, and therefore makes an intake/adjudication/outcome-record shell
necessary under **every** legal reading.

Measured inputs the design leans on (live catalog, 2026-08-19): `search_patient_xref`
exists (exact hashed MRN/encounter, hospital-scoped, audited, gated
`is_pqs_operator_of`); `patient_xref` covers exactly `event`/`referral`/`case` and its
rows survive disposal (`disposed_at`/`disposed_reason`); `hospital_admin` passes the
tenancy arm of three doors but **not** `dispose_case_phi` (staff_admin only);
`reopen_meeting` sets `revoked`, which is **outside** the child-lock's raise set — so a
lawful surgical-redaction corridor already exists; `notifications.title/body` are copied
from entities at write time and **no dispose door touches them**.

## Decisions (Q-numbers = the design session's record)

1. **The feature is a DSR case-management workflow** (Q1a): intake → out-of-band identity
   verification → adjudication → outcome ∈ {`granted`, `granted_partial`,
   `refused_retention`, `refused_identity`, `withdrawn`} → execution tasks → two-phase
   close. Refusal carries a **required** legal-basis text (Art. 18 §4). Counsel's scope
   question runs in parallel (Q1c/Q14; ADR 0035 Amdt 1); **only** the `refused_retention`
   guidance copy and the default adjudication stance block on its return.
2. **Powers are split; no disposal gate widens** (Q2b): intake + adjudication + close
   belong to a new per-hospital **`dpo` delegated-capability grant** (Q7b; ADR 0061
   pattern, granted by org/hospital admin — the Encarregado is often not the hospital
   admin). Execution stays with the roles that already hold each door (staff_admin for
   cases; PQS/tenancy for events, referrals, meetings). The DSR **assigns** tasks; it
   never fires a door on the executor's behalf. Executors complete tasks; **only the DPO
   closes** the request (Q16iii).
3. **One deliberate widening, named**: `search_patient_xref` gains an
   `app.is_dpo_of(hospital)` arm (Q7b). It is a PHI-search gate widening and gets the full
   ADR-0079 treatment when built. Discovery is **exact hashed MRN/encounter only** — no
   name search, no substring, no browse (Q3a).
4. **Hospital-scoped, silently** (Q4a): the controller is the hospital. No cross-hospital
   match hints — "this patient also has records at Hospital B" is itself the cross-tenant
   inference the isolation model exists to prevent. A patient treated at two hospitals
   files two requests.
5. **The DSR record is PHI-free — Rule 12's "exactly three modules" survives** (Q6):
   `dsr_requests` stores `patient_key` (the peppered hash, resolved once at intake via the
   search door), hospital, a paper-file/DMS reference, dates, outcome, basis text,
   `due_date`. The platform never stores or displays who the request is about; identity
   documents stay in the hospital's own files.
6. **The claim is two-tier, stated in the outcome record** (Q5a): *mechanical* —
   xref-linked records (events, referrals, cases and their graphs) found and disposed by
   machine; *attested* — free-text surfaces (meeting minutes prose, non-case form
   responses, narratives, document bytes) reviewed by a named human, with the redaction
   count recorded. `patient_xref` structurally cannot find a name typed into prose; no
   refactor changes that, so the honest claim is the two-tier one.
7. **Surgical prose redaction uses the existing revoke corridor** (Q10a): `reopen_meeting`
   (→ `revoked`, children unlock) → edit → re-sign; the revision bump correctly
   invalidates registered prints (ADR 0126). ⛔ No in-place redaction door for locked
   content will be built — that is the child-lock defect's evil twin, a bypass that works.
8. **Full meeting disposal is unblocked by ADR 0129** (Q11, shape 2 — the narrow
   `app.in_disposal_rpc` flag), a prerequisite of this workflow's meeting lane.
9. **Residue** (Q12a): the four dispose doors gain **notification scrubbing**
   (redact/delete `notifications.title`/`body` by `entity_type`,`entity_id` — the one
   residue class that is cheap and mechanical), each with a pgTAP pin. Everything
   genuinely unreachable goes into **fixed, pre-written residue language** in the outcome
   record — Cloud PITR window, distributed/downloaded prints, Cloud byte-proof being
   metadata-level only (D9) — decided once here, never improvised per request by an
   operator.
10. **Deadline is a badge, not a promise** (Q9iii): `due_date` (15 days) surfaced in the
    worklist; **no scheduler exists** (Critical FUP C1's finding), so nothing automated is
    claimed.
11. **Surfaces** (Q8b, Q16): one **DSR task inbox** at `/o/[org]/titulares` ("Direitos do
    Titular"), feature flag **`dsr`**, hospital-scoped internally like the NSP area.
    Executors execute there under their own sessions — zero gate changes by construction.
    This surface **subsumes** pilot-gate item 0 (`FUP-ACT-DISPOSE-UI`) and the unfiled
    meetings-dispose-UI gap (ADR 0056 Consequence (a), never built).
12. **Repeat requests are idempotent via the xref's existing disposal columns** (Q16iv):
    disposed entries surface as history ("previously disposed on <date>"), never re-fire.
13. **Sequencing** (Q13a): slice 1 = ADR 0129 alone — ✅ **SHIPPED 2026-08-19**. ⛔ **Its
    stated payoff was wrong in grain:** slice 1 does **not** unblock C1a §3 → C1b → the
    pilot's PHI bound. Measured at build time, C1a is a run of the `file_objects`/Storage
    disposal runbook and `dispose_meeting_minutes` is disjoint from it; what slice 1 fixes is
    **meeting-minutes erasure**, which is this workflow's meeting lane (Decision 8) and not
    the pilot bound. The slice ORDER is unaffected — slice 1 was still correctly first, as the
    meeting lane's prerequisite. See ADR [0129](./0129-meeting-child-lock-disposal-flag.md)
    Consequences. Slice 2 = minimal execution corridor (discharges pilot-gate item 0); the
    full workflow follows pilot-independently. Details: the plan document.

## Consequences

- The refusal path exists for the first time; the hospital can *answer* a DSR either way
  and prove it did. The over-claim family (ADR 0056's "tudo apagado" defect, refiled
  2026-08-19 as `FUP-DISPOSE-DIALOG-OVERCLAIM`) gets its fix vehicle: all disposal-adjacent
  copy moves to the tier-honest residue language.
- New schema (`dsr_requests`, `dsr_tasks`, the `dpo` grant) is PHI-free and additive;
  the only gate change anywhere is the named search-door widening (Decision 3).
- Open, deliberately: counsel's scope return (ADR 0035 Amdt 1) and the
  `superseded`-vs-`retention_expired` reason value (stays with the D11 implementing
  slice per ADR 0121 Amdt 2 — this ADR does not settle it).

## Amendment 5 — Amendment 4's withdrawal reaches the CODE, and its rationale is COMPLETED

**2026-08-20 · `backend` · migration `20261003000100_retire_notify_scrub_check_task.sql` ·
suite `supabase/tests/354_dsr_notify_scrub_retired.sql` (12 tests).**

> **Amendment 4 withdrew Decision 9's notification-scrubbing clause as premise-falsified. The
> withdrawal reached this ADR and never reached the code.** `create_dsr_request` went on minting one
> `notify_scrub_check` task per request, and `close_dsr_request` raises HCDS4 while any task is
> `pending` on a `granted`/`granted_partial` outcome. So **every granted LGPD subject request was
> blocked until a human attested to a residue class this program had proved absent** — and the
> attestation text asserts, in a legal record, that something was checked which cannot exist.
>
> ⭐ **AND AMENDMENT 4'S RECORDED RATIONALE IS INCOMPLETE. Do not repeat it.** Item 1 argues that
> `notifications.entity_type`'s CHECK does not admit `case` / `referral` / `event`. True — and **not
> sufficient**: the same CHECK admits **`meeting`** and **`capa_action`**, and the disposal doors
> touch both lanes. Stated as it stands, the argument is a real filter cited for a conclusion it
> does not bound.
>
> **The complete argument is a census of the WRITERS, measured from the catalog:**
> `app.enqueue_notification` is the only `insert into public.notifications` there is, with **16
> callers / 25 call sites** (`--` comments stripped before matching). Every (entity_type,
> body-source) pair: `capa_action` ← `capa_action.title` · `meeting` ← `meetings.title` (verbatim,
> or title + a fixed string in the two minutes-job lanes) · `action_item` ← `action_items.title` ·
> `controlled_document(_version)` ← `controlled_documents.code || ' — ' || .title` ·
> `commission` ← the commission NAME + a fixed string · `ethics_notification` ←
> `ethics_notifications.notification_type` (a CHECK enum) or a fixed string ·
> `response_section_signoff` ← NULL or a form SECTION title.
>
> **Cross-referenced against all four `dispose_*` bodies: every admitted `entity_type` reachable
> from a disposal door carries a TITLE as its body** — and ADR
> [0131](./0131-phi-erasure-reach-bounded-to-designated-fields.md) Amendment 1's *title invariant*
> puts titles out of erasure scope by design, which is why `dispose_meeting_minutes` deliberately
> never touches `meetings.title` and `dispose_event_phi` never touches `capa_action.title`.
> (`controlled_documents.title` is a different table from the `documents.title` the case and
> referral doors redact; no door writes `controlled_documents`.) **So the conclusion holds — for a
> better reason than the one on file.**
>
> ### What shipped, and what deliberately did not
>
> - ✅ The mint is **removed** from `create_dsr_request`; every other statement is unchanged.
> - ⛔ `notify_scrub_check` **stays in `dsr_tasks_kind_check`** and stays admitted by
>   `complete_dsr_task`: historical rows must remain valid AND completable. Retiring the *minting*
>   must not strand the *completion*.
> - ⛔ **No backfill.** Flipping surviving `pending` rows to `blocked` would make them
>   indistinguishable from a **refusal** retirement — `blocked` means "retired by decision" in the
>   vocabulary `close_dsr_request` writes, and Amendment 3's QA-r2 correction binds: no surface may
>   name the cause of a retirement from `status` alone. **The migration touches no existing row**,
>   which is true of every environment and is therefore the only safe thing to claim about any of
>   them. Measured locally on a fresh reset: **0** `dsr_requests`, **0** `dsr_tasks`, so the local
>   population of affected rows is zero.
> - ⛔ `close_dsr_request` is **unchanged**. Its HCDS4 pending-task gate is a real control on
>   erasure completeness and stays; it simply stops firing on a task nobody asked for.
> - `src/lib/dsr/messages.ts` keeps its render copy, so a historical row still labels correctly.
>
> ### Mutation-proven
>
> Restoring the pre-fix mint (catalog-derived rewrite, hash-verified both ways) turns `354`
> **RED at t3, t5, t8, t9, t10, t11** — including **t10, the granted close**, which is the
> differential. **t12 stays GREEN**, which is the point: the HCDS4 gate itself still refuses a
> genuinely pending task, so t10 cannot be satisfied by deleting the gate.
>
> ⚠ **One vacuity was caught in this suite's own first draft, by asking what the mutation would do
> rather than by the suite going green — it did go green.** Completing *every* pending task before
> the close models an executor who also attested to the phantom residue; t10 would then have passed
> identically with the task still minted. The fixture now completes everything **except**
> `notify_scrub_check`, which is what makes t9/t10 a differential at all.
>
> ### Downstream, routed rather than edited
>
> pgTAP `349` t12 asserted `= 1` and is reversed to `= 0` in place, with `354` named as the
> contract; the dead `task_scrub` / `task_scrub_b` lookups in `349`/`350` (assigned, never read,
> and now resolving to NULL) are removed. **Three Playwright specs assert the minted kind list and
> will go red** — `e2e/dsr-subject-requests.spec.ts:190,209`,
> `e2e/dsr-slice3-adjudication.spec.ts:314,344` (+ its header comment `:28` and the
> BUG-DSR-S3-003 note `:1167`). `e2e/**` is tester-owned and was **not** touched.
