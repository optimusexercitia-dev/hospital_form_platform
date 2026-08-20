# ADR 0130 — DSR workflow: data-subject requests as adjudicated cases, not an erase button

**Status:** Proposed (design PO-ratified 2026-08-19, sixteen decisions in a structured
design session; ⛔ **nothing may be built until a future session picks this up** — PO
instruction) · **Date:** 2026-08-19 · **Feature:** LGPD Art. 18 request intake /
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
>    for once. ⚠ Lead-drafted interpretation of "together with legal consultation" —
>    confirm the required/optional split at implementation kickoff before the migration is
>    written.
> 4. **The `subject_request` lane is live** (no longer contingently closed): the dispose
>    dialog's Art. 18 reason option is valid; `FUP-DISPOSE-DIALOG-OVERCLAIM` reduces to the
>    over-claim alone.
>
> Nothing else in this ADR moves. Status stays **Proposed**; implementation still waits.

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
13. **Sequencing** (Q13a): slice 1 = ADR 0129 alone (unblocks C1a §3 → C1b → the pilot's
    PHI bound); slice 2 = minimal execution corridor (discharges pilot-gate item 0); the
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
