# PHI column-disposal procedure — the four erasure doors

> **Status:** operational procedure. Created 2026-08-20 to discharge
> **`FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`**.
> **Substrate: DATABASE COLUMNS.** For the *other* substrate — Storage bytes and the
> `file_objects` disposal queue — see
> [`phi-disposal-runbook.md`](./phi-disposal-runbook.md). ⛔ The two are **disjoint
> mechanisms**, and a green run of one proves nothing about the other.
> **Binding decisions:** ADR [0056](../decisions/0056-phi-disposal-closure-narrowed-claim.md)
> (the doors + the narrowed claim) · ADR
> [0129](../decisions/0129-meeting-child-lock-disposal-flag.md) (the child-lock stand-aside) ·
> ADR [0130](../decisions/0130-dsr-subject-request-workflow.md) (the DSR workflow that calls
> them) · ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md)
> (**reach is bounded to designated PHI fields**) · Architecture Rule 12.

## 0 · Why this document exists

PHI leaves this platform by **two** substrates and, until this document, only one had a
procedure.

| substrate | mechanism | procedure |
|---|---|---|
| Storage **bytes** (`file_objects` → `disposal_pending` → `disposed`) | `complete_document_disposal`, which **nothing automated calls** | [`phi-disposal-runbook.md`](./phi-disposal-runbook.md) |
| Database **columns** (`event_patient`, `patient_identifiers`, `referral_patient`, plus designated redactions) | the four `dispose_*` doors, which complete **synchronously** | ⭐ **this document** |

The column doors never got a procedure precisely *because* they complete synchronously —
there is no queue to drain, so there was nothing to schedule. The risk that created is
narrower and sharper: **a green run of the bytes runbook reads as covering PHI disposal.**
It does not. The runbook says `meeting`, `minutes_md`, `dispose_meeting_minutes` and
`dispose_event_phi` **zero** times.

⛔ **This document is not a second execution path.** The doors are called from the product —
normally from the DSR task inbox at `/o/[org]/titulares`. This is what an operator reads
**before** executing one and **after**, to know what happened and how to prove it.

## 1 · Scope — what these doors erase, and what they do not

**ADR 0131 is the governing bound: erasure reaches DESIGNATED PHI fields. It does not extend
to columns that merely MAY contain PHI.**

| in scope, must be complete | out of scope, knowingly retained |
|---|---|
| The three Class-1 modules — `event_patient`, `referral_patient`, and `patient_identifiers` anchored on the patient `participants` row — plus the fields explicitly designated to carry patient data | Free text and titles that *could* hold PHI if an operator typed it there. **133 candidate columns**, measured and **accepted** — see [door-erasure-freetext-census.md](../progress/door-erasure-freetext-census.md) |

⛔ **The census is a record of accepted residue, not a record of nothing found.** If a data
subject asks what was retained, that document is the answer.

**The compensating controls are two-layered** (ADR 0131 Amdt 2): *preventive* — training,
plus the `"Não inclua dados do paciente."` helper text on free-text and title inputs;
*corrective* — the **reopen → edit → re-sign** corridor. ⛔ The corridor is **bounded**: only
the `rca` lane is fully covered, and six lanes have a structurally terminal state no door
reverses. For a **distributed or cancelled** meeting's non-erased columns there is **no
removal path at all**. Say so plainly if asked; do not promise a correction you cannot make.

⛔ **There is no in-place redaction door and one will not be built** (ADR 0130 D7). The
corridor is the sanctioned surgical path.

## 2 · Preconditions

1. **The `dsr` flag is on** for the tenant, and the lane's own flag is on
   (`patient_safety` · `case_patient` · `case_referrals` · `meetings`). A door raises
   `HCDS1`/lane-specific codes rather than silently no-op'ing when its flag is off.
2. **The caller holds the door's own gate** — these differ per door and are **not**
   interchangeable:

   | door | gate |
   |---|---|
   | `dispose_event_phi` | `is_tenancy_admin_of(commission)` **OR** `is_pqs_operator_of(hospital)` |
   | `dispose_case_phi` | `is_staff_admin_of(commission)` — coordinator only |
   | `dispose_referral_phi` | `is_tenancy_admin_of(source commission)` **OR** `is_pqs_operator_of(source hospital)` **OR** `is_pqs_operator_of(target hospital)` |
   | `dispose_meeting_minutes` | `is_staff_admin_of(commission)` **OR** `is_tenancy_admin_of(commission)` |

   ⚠ **The operator who may dispose may not be the one who may correct.**
   `reopen_meeting` gates on `is_staff_admin_of` alone, so a tenancy admin can erase a
   meeting's minutes and cannot reopen the meeting to redact prose.
3. **`p_reason` is one of** `retention_expired` · `subject_request` · `entered_in_error` ·
   `duplicate` · `other`. Anything else raises `check_violation`.
4. **The record has not already been disposed.** A second call raises **`HC056`** — the doors
   are one-shot by design. That is not an error to retry.

## 3 · The procedure

### Step A — decide, and record the decision before executing

For a subject request this is `adjudicate_dsr_request`, and the tasks it mints are the work
list. ⛔ **Do not call a door outside a recorded decision** — the audit row records *that* the
erasure happened and *who* did it, never *why it was owed*. The why lives in the DSR request.

### Step B — execute from the product

Normally: `/o/[org]/titulares` → open the request → the task inbox → **"Executar descarte e
concluir"** (or, for a meeting lane task, **"Descartar a ata"** → type `APAGAR` →
**"Apagar a ata definitivamente"**).

The door runs under **the executor's own session**, not a service role. ⛔ That is deliberate
and load-bearing: `complete_dsr_task` verifies the *effect* (`phi_disposed_at`), it does not
mirror the gate. Executing outside the product bypasses no authorization but it does bypass
the task bookkeeping, so the request cannot be closed.

### Step C — read what it did

Each door emits exactly one audit action. **This is the evidence path a verifier reads:**

| door | audit action | `entity_type` | stamps written |
|---|---|---|---|
| `dispose_event_phi` | `event_patient.disposed` | `event_patient` | `patient_safety_event.{has_patient=false, phi_disposed_at, phi_disposed_by, phi_disposed_reason}` |
| `dispose_case_phi` | `case_patient.disposed` | `case_patient` | `cases.{has_patient=false, phi_disposed_at, phi_disposed_by, phi_disposed_reason}` |
| `dispose_referral_phi` | `referral_patient.disposed` | `referral_patient` | `case_referral.{has_patient=false, phi_disposed_at, phi_disposed_by, phi_disposed_reason}` |
| `dispose_meeting_minutes` | `meeting_minutes.disposed` | `meeting` | `meetings.{phi_disposed_at, phi_disposed_by, phi_disposed_reason}`, `meeting_minutes_jobs.purged_at` |

⚠ **`entity_type = 'case_patient'` names a FLAG KEY, not a table.** The case module's PHI
lives in `patient_identifiers` keyed to the patient `participants` row. Verify against the
catalog, never against that string.

### Step D — verify, and know what the verification is worth

Two independent checks. Run **both** — the stamp and the absence can disagree, and a
disagreement is the finding.

```sql
-- 1. THE STAMP: the door recorded that it ran.
select id, has_patient, phi_disposed_at, phi_disposed_by, phi_disposed_reason
  from public.cases where id = :case_id;          -- or patient_safety_event / case_referral / meetings

-- 2. THE ABSENCE: the Class-1 rows are actually gone. Count, never "is it null".
select count(*) from public.patient_identifiers pi
 where pi.participant_id in (
   select cp.participant_id from public.case_participants cp
     join public.participants p on p.id = cp.participant_id
    where cp.case_id = :case_id and p.participant_type = 'patient');
-- expect 0

-- 3. THE AUDIT ROW exists and names a human.
select action, entity_type, entity_id, actor_id, created_at, metadata
  from public.audit_log
 where action = 'case_patient.disposed' and entity_id = :case_id;
```

⛔ **Check 1 alone is not verification.** A stamp with rows still present is exactly the
failure mode `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW` produced in reverse, and the shape
that makes `expect(row?.field).not.toBeNull()` pass on an absent row. **Count rows; do not ask
whether a column is null.**

⛔ **What none of this proves.** The `patient_xref` row is **retained**, stamped disposed —
by design; it holds non-reversible keyed hashes and is not a PHI store. Attachments and file
bytes are a *different substrate* and follow the bytes runbook. The PITR window still holds
the erased content for some days. Copies already printed or distributed are outside the
platform. This is what `DSR_RESIDUE_NOTICE` tells the data subject, and it is true.

## 4 · When a door refuses

| symptom | meaning | action |
|---|---|---|
| `42501` | The caller does not hold that door's gate | Route the task to a hat that does — see §2.2. ⛔ Never widen the gate |
| `HC056` | Already disposed | Not an error. The record is one-shot; read the existing stamp |
| `check_violation` on the reason | `p_reason` outside the five | Fix the call |
| `HC0D3` | An active **legal hold** on a document or file object | ⛔ **BY DESIGN.** A legal hold outranks an erasure request. Resolve the hold, or record the refusal with its basis on the DSR request |
| `HC047` / `HC049` / `23514` from a child lock | ⛔ **A DEFECT, not a state.** The door aborted and **nothing was erased — including the designated PHI that was deleted first.** | Do **not** retry, do not work around it. File it. See §5 |

## 5 · ⛔ The failure class this document was written after

On 2026-08-20, `dispose_event_phi` and `dispose_case_phi` were measured to **abort entirely**
on ordinary mature records — a `completed` RCA, a `completed`/`cancelled` CAPA plan, a
`completed`/`cancelled` interview, or a case discussed at a **signed** meeting. Each abort
came from a child-lock trigger raising *after* the door's Class-1 DELETE, rolling the whole
RPC back: `event_patient` 1 → **1**, `phi_disposed_at` **NULL**.

Two properties of that failure are worth carrying:

1. ⭐ **It failed loudly, and that was the only mercy.** A door that half-erases silently is
   strictly worse. If one of these ever refuses, believe the refusal.
2. ⛔ **A stamped record is not an erased record, and an erased record is not a stamped one.**
   The two checks in Step D are independent for this reason.

Fixed 2026-08-20 by extending the `app.in_disposal_rpc` stand-aside to the sibling child locks
(ADR 0129 Decision 1 repeated per lane). ⛔ **The invariant that keeps that safe: the flag is
set only by disposal doors, and the setter count is what bounds the bypass.** If a future
change teaches a non-disposal door to set it, this procedure's guarantees do not hold.

## 6 · Records to keep per run

For a subject request the DSR outcome record is the artifact; nothing extra is owed. For an
erasure run outside the DSR workflow (retention expiry, entered-in-error), record: the door,
the entity id, the reason, the executing user, the audit `created_at`, the Step-D counts —
**and, when the answer is not zero, what remains and why**.
