# DSR ("Direitos do Titular") — implementation plan

**Status: ALL FOUR SLICES BUILT (2026-08-19 / 2026-08-20 ×3); there is no Slice 5. Slice 4 is
QA APPROVED at r3** (r1 + r2 were CHANGES REQUESTED); its item 1 WITHDRAWN as premise-falsified
(ADR 0130 Amdt 4), and the `dispose_meeting_minutes` widening it was blocked on has **landed**
(pgTAP `351`). ⛔ **What is pending is the GATE, not the build** — §6 step 4 (PO approval) and
step 5 (record + rotation) are owed, and nothing is merged or pushed. **Live status is
PROGRESS.md § Now**; this header is a pointer, and it went stale for a day while three
conflicting statuses sat in one commit. ADR 0130 moved **Proposed → Accepted 2026-08-20** on PO instruction, which
lifted the original "nothing may be built" hold. Design ratified by the PO in a structured
sixteen-decision session on 2026-08-19; the binding decisions live in ADR
[0130](../decisions/0130-dsr-subject-request-workflow.md) (workflow) and ADR
[0129](../decisions/0129-meeting-child-lock-disposal-flag.md) (prerequisite fix), with
counsel's retention ruling recorded in ADR
[0035](../decisions/0035-lgpd-anvisa-regulatory-posture.md) **Amendment 1**. This
document is the *how*; where it disagrees with those ADRs, the ADRs win; where either
disagrees with the live catalog, **the catalog wins** (CLAUDE.md graphify exception).

**For the session that picks this up, in order:**
1. Read ADR 0129 + ADR 0130 + ADR 0035 Amdt 1 (short).
2. Re-measure every "Measured inputs" row below — they were true on 2026-08-19 and
   nothing gates their staleness.
3. ✅ **Counsel's Q14 return ARRIVED 2026-08-19** (ADR 0035 Amdt 1 resolution + ADR 0130
   **Amendment 1**): committee records are NOT prontuário (CFM 1821 does not attach);
   removal requests adjudicated **case by case with legal consultation**; 20-yr retention
   adopted **by default as institutional policy**. Nothing blocks on counsel anymore.
   ✅ **The one open kickoff confirmation is CLOSED (PO, 2026-08-19): `legal_consultation_ref`
   is NOT NULL for `granted` / `granted_partial` / `refused_retention`, optional for
   `refused_identity` / `withdrawn`** — exactly as 0130 Amdt 1 item 3 drafted it, and it is
   **BUILT** (the `dsr_requests_legal_consultation` CHECK + the door's pt-BR refusal, 349 t29/t31).
4. Read `docs/progress/authz-handoff.md §7` before any RLS/gate work (standing ⭐ rule).
5. **All four slices are built; Slice 4 is QA APPROVED at r3 — only the gate is open.** ⛔ Read ADR 0130
   **Amendments 3 and 4** before extending any of this. Amdt 3: six shape changes measurement forced on
   Slice 3, two live defects found in passing, one ACL over-grant an existing pin caught.
   Amdt 4: Slice 4's notification-scrubbing item was **withdrawn as premise-falsified** —
   ⚠ note *what* was wrong, because the same reading error is cheap to repeat: the design
   was inferred from **column names** (`entity_type`/`entity_id` read as a polymorphic
   handle to the disposed entity) rather than from the **writers**, and it was internally
   coherent the whole time. The successor question is `FUP-DOOR-ERASURE-FREETEXT-CENSUS`,
   which is about the doors, not about `notifications`.

---

## 0 · Measured inputs (2026-08-19 — RE-MEASURE, never quote)

All from the live local catalog (`pg_get_functiondef` / `information_schema`), not
migration text:

| Fact | Measured value | Why it matters |
|---|---|---|
| `search_patient_xref(p_mrn, p_encounter, p_hospital_id)` | exists; SECURITY DEFINER; gate `app.is_pqs_operator_of(hospital)`; exact hashed match via `app.derive_patient_key`; audits `patient.searched` on ≥1 match | The discovery door. S3 adds the one deliberate widening: an `app.is_dpo_of(hospital)` arm |
| `patient_xref` | `(module, entity_id)` PK; `module ∈ {event, referral, case}`; has `disposed_at`, `disposed_reason` | Mechanical-tier census source; disposal history for idempotence (Q16iv). **Meetings are not in it** — meetings enter DSRs only via the attested tier |
| Disposal-door gates | `dispose_case_phi` → `is_staff_admin_of` only; `dispose_event_phi` / `dispose_referral_phi` → tenancy + PQS/NSP arms; `dispose_meeting_minutes` → `is_staff_admin_of` OR `is_tenancy_admin_of` | Executor assignment routing (S2). ⛔ **None of these gates change** in this program |
| `app.is_tenancy_admin_of_for` | admits `org_admin` (org) and `hospital_admin` (hospital) | hospital_admin already passes 3 of 4 doors; cases are the deliberate exception |
| `app.guard_meeting_child_lock` | reads **no** GUC; raises on `in_signature/signed/distributed/cancelled`; installed on 4 child tables | The 0129 subject. Its raise set does **not** include `revoked` |
| `reopen_meeting` | sets `status = 'revoked'` | The surgical-redaction corridor (Q10a): revoke → edit → re-sign; revision bump invalidates prints (ADR 0126) |
| `notifications` | has `title`, `body` (entity-derived text); **no dispose door touches the table** | ⛔ **NOT a residue class — premise falsified in S4** (ADR 0130 Amdt 4). `entity_type`'s CHECK admits neither `case`, `referral` nor `event`, and no notification text source is erased by any door |
| Dispose UI census | Only referrals have a component (`referral-dispose-dialog.tsx`); case/event actions exist with **no** caller; meetings have **no action and no UI** | S2/S3 build the single inbox instead of 4 module UIs |
| Feature flags | `app.feature_flags(key, enabled, description)`; one key per module | New key: `dsr` |
| Route precedent | `/o/[org]/nsp` (hospital-scoped internally, has `pacientes/` search UI), `/o/[org]/qualidade` | Mount: `/o/[org]/titulares` |

## 1 · The sixteen ratified decisions (index)

Q1a adjudication workflow, refusal first-class · Q2b split powers, zero door widenings ·
Q3a MRN/encounter-exact discovery only · Q4a hospital-scoped, silent · Q5a two-tier claim
· Q6 hash-only DSR record (Rule 12's "exactly three" survives) · Q7b per-hospital `dpo`
capability grant + the one named search-door widening · Q8b single task inbox, executors
under their own sessions · Q9 outcome enum + required refusal basis + due-date badge (no
scheduler) · Q10a revoke corridor for prose redaction (⛔ no in-place redaction door) ·
Q11 child-lock fix shape 2 (ADR 0129) · Q12a notification scrubbing in doors + fixed
residue language · Q13a slice order below · Q14a counsel-return handling — ✅ RETURNED
same day, settled via ADR 0130 Amdt 1 (nothing blocks) · Q15 the paper trail (this
commit) · Q16 `/o/[org]/titulares`, flag `dsr`, two-phase close, xref-based idempotence.

## 2 · Slices

### Slice 1 — the child-lock fix (ADR 0129). Standalone; FIRST; small. ✅ SHIPPED 2026-08-19.

Backend only. ✅ **SHIPPED 2026-08-19** — migration
`20260930000100_disposal_flag_through_meeting_child_lock.sql`, suite
`supabase/tests/348_disposal_flag_meeting_child_lock.sql` (15 tests). ⛔ **CORRECTION: it does
NOT unblock C1a §3.** That link was wrong in grain — C1a is a run of the disposal runbook, which
is the `file_objects`/Storage path, and `dispose_meeting_minutes` is disjoint from it in the
catalog. What Slice 1 fixes is **meeting-minutes erasure**; C1a's status is unchanged. Full
record: ADR [0129](../decisions/0129-meeting-child-lock-disposal-flag.md) § Build record +
Consequences.

1. Migration: `app.guard_meeting_child_lock` gains the single
   `current_setting('app.in_disposal_rpc', true) = 'on'` stand-aside;
   `dispose_meeting_minutes` sets/resets that GUC around its child UPDATE and its false
   comment is corrected. **Same migration** amends nothing else.
2. Amend ADR 0126 §E in the same commit (its "reads no RPC flag at all" bound goes
   false — ADR 0129 Decision 3).
3. pgTAP (new numbered suite): the locked-WITH-agenda fixture — success path, the
   no-flag differential, the sibling-RPC over-grant twin (0129 Obligations, all three).
   ⚠ Fixture must enable the meetings flag (pgtap-fixture-flag-gaps).
4. Gates: `npm run test:db` on a **fresh reset**; `ARM=census`, `ARM=hat`, `ARM=floor`,
   `FROMFINDINGS=1 ARM=wrapper`; **diff-scoped door sweep** over exactly the two changed
   objects (derive the list from the migration diff, never by hand — ADR 0079 Amdt 1).
5. Register: move `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` to resolved **only on
   this evidence**; C1a's blocker note in PROGRESS.md § Now comes off in the same edit.

**After S1 (not part of it):** the C1a §3 disposal rehearsal can run
(`docs/deployment/phi-disposal-runbook.md`), and it **must name a locked meeting WITH
agenda items as a fixture**. That rehearsal is PO/lead-sequenced work, not this plan's.

### Slice 2 — minimal execution corridor. ✅ SHIPPED 2026-08-20. Discharges pilot-gate item 0.

The smallest thing that makes "a persona can reach a dispose affordance AND pass the
gate" true (dm5-po-decisions § "Remaining pre-pilot work" item 0) — **run and recorded**
there: `pqs.a@test.local` reaches `/o/rede-a/titulares` and passes `dispose_event_phi`,
both halves executed in a browser.

**Built:** migrations `20261001000000` (the `dpo` capability + `app.is_dpo_of[_for]`),
`20261001000100` (`dsr_requests` / `dsr_tasks` + RLS + the three doors),
`20261001000200` (the two console listers); suite
`supabase/tests/349_dsr_request_workflow.sql` (53 tests); `e2e/dsr-subject-requests.spec.ts`
(5 tests); `/o/[org]/titulares` + `src/lib/dsr/` + `src/lib/queries/dsr.ts`.

**Four shape changes measurement forced, all recorded in ADR 0130 Amendment 2** — read it
before extending any of this: the `dpo` grant moved here from Slice 3; `complete_dsr_task`
verifies the EFFECT rather than mirroring four gate expressions; the fan-out never mints
`dispose_meeting` (so **ADR 0056 Consequence (a)'s meetings-dispose UI is Slice 3's**, not
this one's); an unroutable xref row raises instead of being dropped.

⭐ **Two things the build found that the plan could not have predicted:**
1. **`patient_xref` keys the CASE module on a `patient_participants` id, not a case id**,
   while `dispose_case_phi` takes a CASE id. Believing the module name would have shipped a
   case lane that fails closed forever, silently. Pinned by 349 t10b.
2. **`hospital_dpos_select` was BLIND when first written** — opening it left all 46 tests
   green, in the same slice whose suite header warns about exactly that. Found by the
   neutralization sweep, not by review; t32k/t32l exist because of it.

⚠ **And a harness lesson worth more than either.** The first neutralization sweep's
"restore" was a silent no-op (`docker exec … psql -f <hostpath>` resolves INSIDE the
container), so five neutralizations **accumulated** and each verdict after the first was
meaningless — the rising failure counts were the only tell. The replacement harness proves
both channels before touching anything real: a probe mutation must move
`md5(pg_get_functiondef)`, and the restore must move it back. Its first version's proof was
itself vacuous for the same path reason. **A rollback you have not watched succeed is not a
rollback.**

1. **Schema core** (PHI-free, additive): `dsr_requests` (id, hospital_id, patient_key,
   encounter_key nullable, file_ref text, status
   `open/adjudicated/executing/closed`, outcome nullable
   `granted/granted_partial/refused_retention/refused_identity/withdrawn`,
   outcome_basis text — **NOT NULL when outcome is a refusal** (CHECK),
   **legal_consultation_ref text — NOT NULL for granted/granted_partial/refused_retention**
   (CHECK; ADR 0130 Amdt 1 — confirm the split at kickoff), received_at,
   due_date, closed_at/by, created_by, timestamps) and `dsr_tasks` (id, request_id FK,
   kind `dispose_case/dispose_event/dispose_referral/dispose_meeting/attest_review/
   notify_scrub_check`, module+entity_id (nullable for attestation tasks),
   commission_id/hospital_id for routing, assigned-role descriptor, status
   `pending/done/blocked`, completed_at/by, note). RLS: DPO of the hospital reads/writes
   requests; executors read tasks routed to a scope they hold a qualifying hat in;
   platform_admin sees **neither** (noun rule).
2. **Doors** (all `prosecdef`, all swept): `create_dsr_request` (DPO-gated; resolves
   `patient_key` via `app.derive_patient_key`; fans out `dsr_tasks` from
   `patient_xref` rows for the hospital — the mechanical tier; already-disposed xref
   rows become pre-completed history tasks, Q16iv); `complete_dsr_task` (executor:
   requires the task's own door-gate predicate to pass for the caller — the task is
   *completable* only by someone who could fire the door); `close_dsr_request`
   (DPO-only; refuses while tasks are pending unless outcome is a refusal/withdrawn).
3. **UI minimal**: `/o/[org]/titulares` behind flag `dsr` — an executor task inbox:
   my tasks, each linking the entity and hosting the execute affordance, which calls
   the **existing** module action (`disposeReferralPhi` etc.) under the executor's own
   session, then `complete_dsr_task`. Meetings lane: a thin `disposeMeetingMinutes`
   server action (none exists — ADR 0056 Consequence (a)) called from the same inbox.
   Reuse `referral-dispose-dialog`'s shape but with the S4 copy (if S4 hasn't landed,
   ship with the corrected residue copy from day one — do not propagate the over-claim).
4. pgTAP: gate matrix per door (DPO/non-DPO/cross-hospital/executor-wrong-hat), refusal
   CHECK, fan-out vs xref fixture, pre-completed history behavior. E2E: one corridor —
   DPO creates request → PQS executor disposes a referral from the inbox → task done.
   Keyboard flow included (§8 accessibility bar).
5. **Pilot-gate item 0 check, run and recorded**: name the persona (seed: `nsporg.a` or
   a tenancy admin holding the referral-door arm) who reaches the inbox AND passes
   `dispose_referral_phi` — catalog-verified, written into the item-0 row.

### Slice 3 — adjudication, the attested tier, the one named widening. ✅ SHIPPED 2026-08-20.

**Built:** migrations `20261002000000` (the `search_patient_xref` widening + a case-grain
display fix, isolated so the diff-scoped sweep has a two-object case list) and
`20261002000100` (the decision stamp, the attestation columns, `adjudicate_dsr_request`,
`attest_dsr_task`, `list_dsr_disposable_meetings`, and the three changed doors); suite
`supabase/tests/350_dsr_adjudication_and_attested_tier.sql` (⛔ **count deliberately not restated here — read its `select plan(N)`**; a prose number about a machine-checkable fact has no gate, and this one was stale by six within a day); `src/lib/dsr/*`,
`src/lib/queries/dsr.ts`, `src/lib/meetings/actions.ts` (`disposeMeetingMinutes` — ADR 0056
Consequence (a), never built until now), `src/components/dsr/*` + the console lanes.

**Six shape changes measurement forced — all recorded in ADR 0130 Amendment 3**, read it
before extending any of this. Headlines: `adjudicated` was UNREACHABLE (the lane was a
fiction); close now CONSUMES the decision and the direct path survives only for outcomes
that erase nothing; the `dispose_meeting` escalation is explicit per meeting and bounded by
its own request; and **two of the three attested-tier populations this plan named turned out
to be MECHANICAL** — `dispose_case_phi` already erases narratives and case-linked responses,
so the attested tier is meeting prose plus non-case commission free text, and nothing else.

⭐ **Three things the build found that the plan could not have predicted:**
1. `app.patient_trajectory_bundle` rendered EVERY case entry's code as `—`, always, in the
   PQS console too — it compared a `patient_participants` id to `cases.id` (the Slice-2
   grain). A live display defect inside the door being widened.
2. `complete_dsr_task` OVERWROTE the minted procedure text with the completion note, so an
   attestation task's revoke-corridor instructions were destroyed at the moment they were
   being followed.
3. ⚠ The author over-granted `app.patient_trajectory_bundle` — the raw, ungated PHI
   assembler — to `authenticated`, by applying the house `grant to authenticated,
   service_role` idiom to a **rewrite**. Suite `152` §M1 caught it. `CREATE OR REPLACE
   FUNCTION` does not reset an ACL; leave a rewrite's grants alone.

⚠ **And the authz finding that matters most for the next slice.** All four arms
(`census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper`) HOLD — and **none of them can see this
slice's gate change**. ARMs 1/3/5 bound their domain by boolean-ness, the row-door sweep by
row-returning-ness; `search_patient_xref` and all three new doors are `prosecdef` scalar
non-bool command doors (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`). The diff-scoped recipe's own
`^(is_|can_|has_)` filter yields an **empty** case list here, and a `CASES=`-scoped row-door
run swept **0**. Coverage is a hand-run 37-probe neutralization battery, one at a time, every
restore hash-verified — per-keystone verdicts in `350`'s header. Do not read a green arm as a
verdict for this class.

### Slice 3 — original plan (kept for the record)

1. **`dpo` capability**: per-hospital grant table (ADR 0061 `administrativo` pattern) +
   `app.is_dpo_of(hospital_id)` + grant/revoke doors (org/hospital admin), audited.
2. **The one widening**: `search_patient_xref` gains the `is_dpo_of` arm — full
   ADR-0079 treatment (diff-scoped sweep of that door, census/wrapper arms, pgTAP
   matrix incl. cross-hospital DPO refused).
3. **Intake UI** (DPO lane at `/o/[org]/titulares`): search (MRN/encounter exact only),
   create request (hash + file_ref; the UI **never** shows patient identity — Q6),
   adjudicate (outcome + required basis on refusal), due-date badge (15 days;
   badge only, nothing scheduled), close (two-phase: refuses while tasks pending).
4. **Attested tier** (Q5a): `attest_review` tasks per commission-with-plausible-prose
   (meetings, non-case responses, narratives); completed by that commission's
   staff_admin with reviewer name + redaction count in the note. The **procedure** for a
   found mention is the revoke corridor (Q10a) — document it in the task's UI copy;
   ⛔ build no in-place redaction door.
5. ✅ Counsel-return integration (Q14a) — **settled, nothing waits** (ADR 0130 Amdt 1):
   default stance = 20-yr institutional-policy retention, adjudication case-by-case with
   counsel; `refused_retention` copy cites **the institutional policy, never CFM 1821**
   (counsel held it does not cover these records — citing it to a data subject would be a
   false legal basis); the adjudication UI captures `legal_consultation_ref`. Keep the
   copy behind a constant regardless — the next counsel refinement is then a one-file
   change.

### Slice 4 — residue + copy honesty (Q12a; independent of S3, after S2). ✅ BUILT — QA APPROVED r3.

✅ **Item 4 — SHIPPED (added at QA r1, PO-ruled, was BLOCKING).** `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT`
already required *either* the untouched free text join the redaction set *or* the residue
language name it as retained, and named **this slice** as the vehicle. Items 2–3 shipped the
language **without** naming it — so the slice's first act was to enter the one state that
follow-up forbids, while `DSR_RESIDUE_NOTICE` line 1 tells the data subject their database
patient data was erased. Confirmed: `dispose_meeting_minutes` redacts 3 of
`meeting_agenda_items`' 4 text columns (**`title` survives**) and none of
`meeting_attendees.{note,external_name}` or `meeting_closed_sessions.label`.
**PO ruled: widen the door** — migration + one pgTAP pin per column with its vacuity control +
an ADR 0056 §2 amendment, since §2 *declares* the narrow scope. Making the claim **true** beats
hedging it: the notice is shared by all four doors, so a meeting-specific retention line would
be wrong on the referral dialog.
⭐ *The lesson is not the columns — it is that this slice closed an over-claim follow-up while
shipping the constant that carried another one.* An open follow-up naming your slice as its
vehicle is scope you already own, not adjacent work.
✅ **AS BUILT, and wider than this item asked** (pgTAP `351`; ADR 0056 **Amdt 1**): the census
bounded by **composition closure** (FK `NOT NULL` + `ON DELETE CASCADE`, to depth 3) found
**10 columns, not the 4 listed above** — including depth-2 closed-session prose and **jsonb**
minutes text. ⭐ *Free text is not a type*, and a column list read off a follow-up is not a
census. ⛔ **Biggest find:** a minutes job resting in **`done`** kept the **verbatim meeting
transcript** indefinitely — which falsified ADR 0056 **§4** itself, not merely the residue
copy; now purged unconditionally. ⛔ Cite pgTAP **`351`**, never the authz arms:
`ARM=census`/`wrapper` are green and **vacuous here** (the guards return `trigger`, the door
returns `void`) — though ⚠ *not* "no arm", `ARM=floor` does contain `dispose_meeting_minutes`.
⛔ **SUPERSEDED 2026-08-20 — do NOT repeat this widening on the other three doors.** This
paragraph read *"the same census is still owed for the other three doors."* It ran, found
**133 candidate columns**, and the PO ruled the whole class **out of scope for the pilot**:
ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) bounds PHI
erasure to **designated PHI fields**, with **training** as the control for free text that
*may* hold PHI. ⚠ **This widening (the meeting door) is maintained, not rolled back** — 0131
bounds future extension only. Census, retained as the record of what is knowingly accepted:
[door-erasure-freetext-census.md](../progress/door-erasure-freetext-census.md).

1. ⛔ **WITHDRAWN — the premise was false.** This item read: *"Extend all four dispose
   doors: scrub `notifications.title/body` for the disposed entity
   (`entity_type`,`entity_id`) — one pgTAP pin each … plus the vacuity control."*
   Measured against the live catalog before building (**ADR 0130 Amendment 4**, which
   carries the full census): `notifications.entity_type` is CHECK-constrained to eight
   values, and **`case`, `referral` and `event` are not among them** — so the predicate
   matches **zero rows by construction** for three of the four doors, and each "pin"
   would have been vacuous by CHECK constraint. Verified by constructing the state
   (both inserts refused; a `meeting` insert as positive control). Separately, **no
   notification title/body source column is erased by any door**, so even the one
   representable subject (`meeting`) would have had copy scrubbed whose source
   `dispose_meeting_minutes` deliberately keeps (`meetings.title`).
   `FUP-NOTIFICATIONS-PHI-RESIDUE` closed as premise-falsified; the real question it was
   standing in front of is filed as `FUP-DOOR-ERASURE-FREETEXT-CENSUS`.
2. **Fixed residue language** (pt-BR), one shared constant — ✅ shipped in Slice 2 as
   `DSR_RESIDUE_NOTICE` (`src/lib/dsr/messages.ts`): DB PHI erased; attachment bytes
   retained encrypted under the 20-yr regime (ADR 0056 §4); Cloud byte-deletion verified
   at metadata level only; PITR window retains erased content ~N days;
   distributed/printed copies out of reach. Decided once — operators never improvise it.
   ⚠ *"All disposal confirmations"* is **two confirmation dialogs, not four**, so item 2
   collapses into item 3.
   ⛔ **CORRECTED (QA r1).** This first justified that with *"`disposeCasePhi`/`disposeEventPhi`
   have no UI caller at all — re-measured in S4"*, and the re-measurement was **wrong because
   its scope was wrong**: it grepped `src/components/` and `src/app/` only. Both actions ARE
   called, from `src/lib/dsr/actions.ts:102,105`, reached through the DSR task inbox — which
   Slice 2/3 built, so the plan's own earlier census went stale the moment the inbox shipped.
   The conclusion survives **by a better route**: those two lanes confirm inside the task
   inbox, which renders `DSR_RESIDUE_NOTICE` at the confirmation point. ⭐ *A re-measurement
   is only as good as its boundary; "I re-measured" is not a fact about coverage.*
   ⛔ Do **not** read that as the constant's reach: `DSR_RESIDUE_NOTICE` has **four**
   consumers — the two dispose dialogs, the task-inbox disclosure, and
   `queries/dsr.ts` passing it into the outcome record handed to the subject. *Two* counts
   confirmation dialogs; *four* counts render sites, and conflating them understates who
   depends on this wording. Enumerate from the symbol's references, never from a
   hand-kept roster — a roster is falsified by the next surface that renders it.
3. ✅ Rewrote `referral-dispose-dialog.tsx` with it — closes
   `FUP-DISPOSE-DIALOG-OVERCLAIM` (the shipped "apaga permanentemente … todos os campos"
   over-claim vs ADR 0056's narrowed claim). Both over-claiming strings replaced (not
   supplemented), `DSR_RESIDUE_NOTICE` rendered verbatim, and a `subject_request`-only
   note that such a disposal presupposes an adjudicated DSR (ADR 0130).
   ⛔ **STALE — the instrument was SWAPPED 2026-08-20, and this prohibition dissolved with
   it.** This read: *"the verification instrument for this follow-up is a grep, so no prose in
   that file — comments included — may ever quote the removed strings."* That grep's measured
   record was **0 true positives / 4 false positives** — every hit was prose *about* the
   defect, so the instrument forbade writing down the very thing it was verifying
   (`FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING`, closed **by dissolution**). The closure
   instrument is now a **rendered-output** assertion — `referral-dispose-dialog.test.tsx`
   claim 2, property shared from `src/components/dsr/disposal-copy-property.ts` — which
   cannot see comments at all, so comments are free. ⛔ Do **not** re-run the grep to
   re-verify this item. Standing lesson: [`ui-copy-forbidden-strings`](../../.claude/rules/ui-copy-forbidden-strings.md).
   ⚠ Left deliberately, flagged not fixed: the confirm-field helper ("exclusão
   **definitiva**") and the destructive button ("Apagar **definitivamente**") assert
   *finality*, not the *completeness* ADR 0056 (b) forbids; `DSR_RESIDUE_NOTICE` now
   qualifies them two blocks above, and relabelling the button re-scopes E2E locators.

## 3 · Explicitly out of scope

- Any disposal-gate widening (Q2b). Any name/substring patient search (Q3a). Any
  cross-hospital surface (Q4a). Storing patient identity in DSR rows (Q6). An in-place
  locked-content redaction door (Q10a). A scheduler/cron (Q9iii; C1's finding stands).
- The C1a/C1b rehearsals themselves and the disposal-job decision (Critical FUP C1) —
  owned by PO/lead. ⛔ **CORRECTED 2026-08-19: this said "unblocked by S1", which was wrong
  in grain — S1 never blocked C1a.** The runbook is the **`file_objects`/Storage-bytes** path
  and `dispose_meeting_minutes` is disjoint from it in the catalog (writes no `file_objects`
  row, never sets `disposal_pending`; the runbook says "meeting" zero times). S1 fixed
  **meeting-minutes erasure**, not this rehearsal. *A real defect cited for a conclusion it
  did not bound, erring in the reassuring direction: it made C1a read as blocked-then-released
  rather than simply never started.* ⚠ The column doors have **no operational procedure at
  all** — `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`.
- The `superseded` vs `retention_expired` reason value — stays with the D11 implementing
  slice (ADR 0121 Amdt 2).
- `FUP-XREF-PEPPER-ROTATION-ORPHANS` — filed, related (disposal makes pepper rotation
  irreversible for disposed rows), not this program's to fix.
- ⭐ **PROFESSIONAL-SUBJECT requests (the platform's own users), which this program does not
  cover — but which now have a single table to point at.** Added 2026-08-31 by AE3 (ADR
  [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D4);
  QA finding B1. This program's subject is the **patient**, reached through `patient_xref`. A
  request from a *professional* under LGPD Art. 18 (access / rectification / deletion of their
  own CPF, date of birth, phone) is a different subject class with a different discharge path,
  and until AE3 those three values were columns of `profiles` with no single name to cite.

  - **They now live in `public.profile_private_details`** — `profile_id` (PK, FK to
    `profiles.id`, `on delete cascade`) → `cpf`, `date_of_birth`, `phone`, `updated_at`.
  - ⛔ **ROW EXISTENCE IS ITSELF THE "HAS DATA ON FILE" FACT.** Only people with at least one
    of the three have a row. Consequences the operator must not get backwards: an **access**
    request for a person with no row is answered *"nothing on file"*, not *"person not found"*;
    a **deletion** discharge is a `DELETE` of the row, **not** nulling its columns, because an
    all-null row still asserts that this person has restricted details recorded.
  - ⛔ **CPF IS NOT CONSOLIDATED, AND ASSUMING IT IS WILL UNDER-DISCHARGE A REQUEST.**
    `public.professional_profiles.cpf` is a **separate** Class-2 professional-identity column
    (ADR 0064/0065) that AE3 did **not** move. Any professional-subject request touching CPF
    must consider **both** relations. `redact_professional_profile` is that table's own
    redaction door.
  - **Reach:** the table is door-only — RLS enabled, **zero policies**, no grant to
    `authenticated`/`anon` (pgTAP `382`, `359`). Read via `get_own_person_record` (self) and
    `list_org_people` / `getPersonAdminView` (administrative); written via
    `update_person_fields_for` and `finalize_invited_person_for`.
  - ⚠ **AE3 moved storage, not authority.** The administrative (non-DSR-workflow) discharge
    path for professional data is **unchanged** — no gate, capability arm or audit action was
    altered, and the `person.cpf_lookup` probe still emits exactly one row per CPF-parameterised
    directory call. ⛔ This bullet is a POINTER, not a decision: whether professional-subject
    requests should enter this program's inbox at all is undecided and out of scope here.

## 4 · Risks & watch-items for the implementing session

- **Rule 12 census language**: `dsr_requests` must never grow a name/MRN column without
  an ADR amending Rule 12 (it would be a fourth PHI module). Guard: a pgTAP pin
  asserting the table has no columns beyond the declared set is cheap and catches the
  well-meant "just add the name" patch (removing-a-subject caveat: pin the positive
  column list, not "has no name column").
- **`complete_dsr_task` must not become a second door**: it verifies the caller *could*
  fire the module door but never fires it — keep execution in the module action under
  the caller's session, or the inbox becomes a DEFINER bypass of four gates.
- **Two sessions, one local DB** while S1 and the rehearsal are in flight — single
  owner for the stack (shared-local-stack rule).
- The E2E suite has a standing flaky baseline and the print corridor needs its sidecar —
  don't read uniform login failures as product defects (`docs/testing/`).
- New doors are new census subjects: every added `prosecdef` function enters
  `ARM=census`'s domain on creation — a NULL `proacl` includes PUBLIC (the
  guards-that-fail-open family); diff from the catalog after each migration.
