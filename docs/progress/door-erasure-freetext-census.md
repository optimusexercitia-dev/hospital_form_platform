# Free-text census of the three uncensused disposal doors

> ## ⛔ RULED 2026-08-20 — this census is now a RECORD OF ACCEPTED RESIDUE, not a work list
>
> ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) (PO, after
> discussion with the development team): **PHI erasure reaches DESIGNATED PHI fields only.**
> Free text and titles that *may* contain PHI — which is every finding in §3 — are **out of
> scope for the pilot**, with **training** as the compensating control. Shipped reach is
> **maintained, not rolled back**. The pilot's effort goes to *perfect execution* on the
> confirmed PHI set.
>
> **Nothing below is retracted. Everything below is accepted.** This document is kept for
> exactly that reason: a risk acceptance with no record of what was accepted is not an
> acceptance, and a future reader must be able to tell "we looked and found nothing" from
> "we looked, found 133, and decided". This is the second.
>
> ⛔ **Still owed, and NOT descoped by 0131** — both are "perfect execution", not "wider
> reach": `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND` (the door's *authorization gate*) and
> `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES` (the column doors' operational procedure).
> Consequence carried forward: `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING`.

**Status: MEASURED 2026-08-20 (lead) · RULED OUT OF SCOPE the same day (ADR 0131). The
findings below were candidates for a per-column ruling; that ruling was made at the
class level instead. Nothing was widened.**

Discharges the measurement half of 🟠 `FUP-DOOR-ERASURE-FREETEXT-CENSUS`. Subjects:
`dispose_case_phi`, `dispose_event_phi`, `dispose_referral_phi`. The fourth door,
`dispose_meeting_minutes`, was censused in DSR Slice 4 (ADR 0056 Amdt 1) and is used
here as the **calibration baseline**, not as a subject.

⛔ Everything below is read from the **live catalog** (`pg_proc.prosrc`, `pg_constraint`,
`pg_attribute`), never from migration text — CLAUDE.md's binding graphify exception.

---

## 1 · The instrument, and the four times it was wrong

The follow-up prescribed the meeting census's method: *composition closure = FK `NOT NULL`
+ `ON DELETE CASCADE`, depth 3, census by free text rather than by type.* Applied
literally, **that method misses the lane containing the defect the item was filed for.**
Each defect below was caught by a control, not by review.

| # | Defect | How it was caught | Direction |
|---|---|---|---|
| 1 | Walk seeded with `'public.meetings'` but `regclass::text` renders `meetings` — the join never matched, so the closure returned **depth 0 only** | Positive control on the meeting door: a table with three known children reported none | silent — found nothing |
| 2 | Composition closure **cannot reach the capa lane**: `capa_plan.source_event_id` is NULLABLE, so it is not a composition edge — yet the door erases four capa columns | The filed defect (`capa_action.title`) was absent from the output entirely | **under-reports** |
| 3 | "Column name appears in the body" as the erased test: `capa_action.title` read *erased* because `rca_evidence.title` mentions the word | Checked the filed defect explicitly rather than trusting the count | **under-reports** |
| 4 | "Has a CHECK ⇒ controlled vocabulary": `capa_action_title_not_blank` is `btrim(title) <> ''`, a **not-blank guard on free text** | Same — the filed defect read *controlled-vocab* | **under-reports** |
| 5 | A composition child of a **row-deleted** table is erased by CASCADE, but the door never names it — `answer_matrix_cells.value` read as residue | Noticed `delete from answers` and asked whether the FK cascades | over-reports |

**Fixes, in the instrument as it now stands:** seed the walk with the root **∪ every table
the door writes to** (composition tells you what hangs off a lane; only the door tells you
which lanes are in scope); classify per-**statement**, not per-body, so a name in a sibling
`update` cannot certify a different table; treat a CHECK as vocabulary only when it
**enumerates literals** (`= ANY (ARRAY[…])` / `IN (…)`); propagate `row-deleted` down
composition edges.

⭐ **The class:** three of the five defects made the census report *less* than the truth,
and all three would have produced a clean, confident, wrong answer on the one column the
item names. *An enumeration boundary is a syntax; the property is "free text on the lane
this door claims to clear."*

### Control battery — 6 anchors, all passing

Anchored on a **known defect** and on four behaviours that are **correct by design**, so a
pass cannot mean "the detector is asleep":

| anchor | expect | got |
|---|---|---|
| `capa_action.title` — the filed defect, must be FOUND | `NOT ERASED` | ✅ |
| `capa_action_task.description` — erased, must not flag | `erased` | ✅ |
| `event_patient.mrn` — row-deleted, must not flag | `row-deleted` | ✅ |
| `answer_matrix_cells.value` — cascade-deleted, must not flag | `cascade-deleted` | ✅ |
| `patient_safety_event.status` — vocabulary, must not flag | `controlled-vocab` | ✅ |
| `case_narrative_revisions.body_md` — new residue, must be FOUND | `NOT ERASED` | ✅ |

---

## 2 · Calibration — the count is NOT a defect count

Run against `dispose_meeting_minutes`, which the PO ruled **complete** after the Slice 4
widening, the census still returns **16 candidates**. Adjudicating those 16 yields the
rubric every finding below is graded against:

- **(a) cross-door owned** — `meeting_cases.{summary,decision}` are erased by
  `dispose_case_phi`. Covered, wrong door.
- **(b) infrastructure reference** — `audio_path`, `service_job_id`, `content_hash`,
  `provider_ref`, mime types, storage paths. Not prose.
- **(c) retained by design, and disclosed** — `meetings.title` (ADR 0056 keeps it),
  `meeting_signatures.*` (a signature that is redacted is not a signature).
- **(d) genuine residue** — free-text prose on the lane.

⚠ So **16 candidates on a door with zero known residue** is the noise floor. Read the
numbers below as *"columns needing a ruling"*, never as *"columns that leak"*.

---

## 3 · Findings

### `dispose_event_phi` — 22 candidates, 18 erased, 8 row-deleted

**(d) genuine residue — free text on a patient-safety lane:**

| column | why it matters |
|---|---|
| **`patient_safety_event.title`** | operator free text on the **root PHI table**; the door nulls `description_md` beside it and leaves this. An event title is where a name or bed number is most likely to be typed. |
| **`rca_why_chains.steps`** (`jsonb`) | the door erases `rca_why_chains.root_text` and leaves the **chain itself**. ⭐ Exactly the Slice 4 lesson — *free text is not a type*; `jsonb` carried the minutes prose there and carries the why-chain prose here. |
| **`capa_action.title`** | ⭐ **the filed defect, confirmed.** The door erases the grandchild `capa_action_task.description` and leaves the child. |
| `event_custody.note` | free-text note on the event lane |
| `capa_action.success_measure`, `capa_measure.{definition,target,name}` | operator prose on the CAPA lane, siblings of columns the door does erase |
| `capa_action_evidence.title` | free text |
| `patient_safety_event.location` | not PHI alone; identifying in combination |
| `capa_action.owner`, `rca_members.external_name` | **person names — Class-2 professional identity**, not patient PHI. Rule 12 grades these differently; flagged, not lumped in. |

**(b)/(c) out of scope:** `*.code`, `*.securable_type`, `rca.detected`,
`capa_measure_result.period`, `*_evidence.external_url`,
`event_triage_sentinel_flags.criteria_{key,label}` (catalog vocabulary).

### `dispose_referral_phi` — 18 candidates, 16 erased, 8 row-deleted

**(d) genuine residue:**

| column | why it matters |
|---|---|
| **`referral_internal_notes.title`** | the door erases `body_md` and leaves the **title** — the same child/parent shape as `capa_action.title`, in a second door. |
| `referral_reply.outcome_label`, `case_referral.{requested_action_label,type_label}` | free-text labels |
| `referral_resolutions.reopened_reason` | free-text reason |

**(b) out of scope — the byte substrate:** `file_objects.{storage_path,sha256,mime_type,disposal_evidence}`
belong to the `disposal_pending` → `complete_document_disposal` path, **not** to a column
door. ⚠ This is precisely the seam `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES` names, showing
up inside the census as predicted.
**(c) retained by design:** `*.redacted_reason` (the audit trail of a redaction),
`*_commission_name`, `target_hospital_name` (org names, not PHI).

### `dispose_case_phi` — 93 candidates; 17 of the raw set are the referral door's

38 tables after removing cross-door ownership. This door has by far the widest lane, and
two findings dominate:

| column | why it matters |
|---|---|
| ⛔⛔ **`case_narrative_revisions.body_md`** | **the largest finding in this census.** The door erases `case_narratives.body_md` and leaves **every prior revision of the same prose**. An erasure that clears the current narrative and retains its version history has not erased the narrative. |
| ➡ **SPLIT OUT 2026-08-20 (PO) → `FUP-ETHICS-LANE-NO-ERASURE-DOOR` (🔴).** Not a missed column on a covered lane but **a module with no erasure path**, and a second data subject (the accused professional) that this item's framing could not carry. | `ethics_allegations.description_md` · `ethics_appeals.{appeal_reason_md,outcome_rationale_md}` · `ethics_case_details.{admissibility_rationale_md,summary_md}` · `ethics_decision_details.remediation_description_md` · `ethics_findings.{evidence_summary_md,rationale_md}` · `ethics_hearings.{outcome_md,summary_md}` · `ethics_notifications.notes_md`. An ethics case **is** a case; these hang off `cases` by composition and hold narrative prose. |
| `case_custom_field_values.{value,options,label}` (`jsonb`) | operator-defined field **values** — free-form by construction, and `jsonb` again |
| `interview_summaries.summary_md`, `interview_topics.topic`, `interview_sessions.cancellation_reason` | the door erases `case_interviews.summary_md` and `case_interview_subjects.note`, and leaves these siblings |
| `case_decisions.{rationale_md,summary_md}`, `case_votes.rationale_md`, `case_recusals.{reason_md,lift_reason_md}`, `case_conflict_declarations.description_md`, `case_correction_requests.{draft_body_md,last_rejected_reason,reason}`, `case_reopenings.reason`, `case_access_grants.reason`, `case_participants.involvement_summary` | free-text prose across the case lane |
| `case_interview_interviewers.{external_name,external_org}`, `case_interview_subjects.{external_name,external_org}` | **person names — Class-2**, graded separately |

---

## 4 · Consequence for shipped copy

`DSR_RESIDUE_NOTICE` line 1 — *"O descarte apaga os dados do paciente armazenados no banco
para este registro"* — is shown to an operator discharging an LGPD obligation. It is shared
by **all four** doors. On the strength of `case_narrative_revisions.body_md` and the
untouched `ethics_*` lane alone, that line is **not currently true for `dispose_case_phi`**.

⛔ Do not soften the notice as the remedy. The Slice 4 precedent is the PO ruling on the
meeting door: **make the claim true, then disclose what is retained** — a hedge on a shared
constant would be wrong on the three doors where the claim does hold.

---

## 5 · What this does NOT prove

⚠ **This is a static census.** It reads the door body and the catalog; it does not run the
doors. It cannot see an erasure performed by a trigger, a rule, or a cascade my edge
definition does not model, and its `erased` verdict trusts that an `update … set col =`
inside the right statement actually reaches the right rows — a `where` clause that matches
nothing would still read *erased*.

**The instrument that would close that gap is an empirical differential**: seed every
free-text column in each lane with a unique sentinel, run the door under a real caller,
and assert which sentinels survive. That is immune to parsing, to name collisions, to my
closure definition, and to a wrong `where` — and it is the method that found four of the
ten Slice 3 bugs. It is the recommended next build, and it needs fixtures for three lanes.

⛔ Until it runs, no verdict in §3 may be cited as *proof* that a column survives disposal —
only that **nothing in the door names it**.

## 6 · Reproducing

Helpers live in the scratchpad (`census5.sql`), not in the repo — they are a measurement
instrument, not a gate. If this becomes a standing check it belongs in pgTAP, where DB
anchors are checkable; `lint` cannot see `prosecdef`, ACLs or policies (CLAUDE.md §8).

```sql
select * from app_census_v5('public.cases'::regclass, 'dispose_case_phi') where verdict like '⛔%';
```
