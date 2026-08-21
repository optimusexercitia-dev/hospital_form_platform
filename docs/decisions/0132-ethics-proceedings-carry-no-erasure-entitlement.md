# ADR 0132 — An ethics proceeding carries NO erasure entitlement; the absent door is a DECISION, not a gap

**Status:** **Accepted** (PO ruling, relayed 2026-08-21) · **Date:** 2026-08-21 ·
**Feature:** erasure posture for the `ethics_*` lane · **Resolves:** the Class-2
professional-identity question ADR
[0131](./0131-phi-erasure-reach-bounded-to-designated-fields.md) Amendments 3 and 4 both
reserved for the PO, and § Now carried as open · **Relates:** ADR
[0072](./0072-ethics-access-spine.md) §7 (the M2 posture this corrects the *basis* of), ADR
[0035](./0035-lgpd-anvisa-regulatory-posture.md) Amendment 1 (counsel's holdings), ADR
[0130](./0130-dsr-subject-request-workflow.md) (the DSR workflow), CLAUDE.md **Rule 12**.

## Context

ADR 0131 descoped the `ethics_*` lane from PHI erasure on a **scope-of-reach** basis: the
lane holds no *designated* PHI field, and erasure does not extend to columns that merely
*may* contain PHI. That ruling settled the patient half and explicitly refused to settle
the other, closing three times with the same sentence — *"Still not ruled by this ADR, and
still the PO's: Class-2 professional-identity erasure for the `ethics_*` lane's second data
subject."* The reserved question was whether the **accused professional**, whose allegation
text is personal data about them, holds an erasure right the platform must be able to
execute.

The PO ruling of 2026-08-21 answers it on a **different and stronger basis** than 0131's:

> *Ethics committee evaluations are by definition administrative processes with possible
> legal consequences. Therefore, there is no logic or legal authority in permitting any
> parties from requesting their data be removed. Ergo, there is no need for a door or UI to
> satisfy this feature.*

## Decision

**1. An ethics proceeding record carries no erasure entitlement, at any stage of its
lifecycle.** The record *is* the evidence of due process; erasing it destroys the
institution's ability to show that the proceeding was conducted properly, which is the
whole reason the proceeding is documented. This holds from the moment an allegation is
filed — **not** from the moment a decision is issued.

**2. The basis is the administrative-proceeding nature of the record, NOT CFM 1821/2007.**
⛔ This matters and is not a stylistic preference. ADR 0072 §7 and ARCHITECTURE.md Rule 12
both pin the Class-2 retention posture to *"CFM-1821/2007, 20-yr floor"*. Counsel's return
of 2026-08-19 (ADR 0035 Amendment 1, holdings 1 and 2) holds that CFM 1821/2007 does **not**
attach to committee documentation and that refusal language must cite the **institutional
policy, never CFM 1821/2007 directly**. That correction was never propagated to 0072 or Rule
12, which have carried a disclaimed legal basis since. This decision replaces it with one
that does not depend on CFM 1821 at all, and Decision 6 below repairs the two documents.

**3. Scope — the proceeding record and the respondent, NOT patient PHI.** PO-selected
2026-08-21 from two readings put to them explicitly:

- **In scope (non-erasable):** the seven case-scoped `ethics_*` tables
  (`ethics_allegations`, `ethics_appeals`, `ethics_case_details`,
  `ethics_decision_details`, `ethics_findings`, `ethics_hearings`,
  `ethics_notifications`) and the **respondent professional's identity** on
  `professional_profiles`.
- **Out of scope (unchanged):** patient PHI held on an ethics-*typed* case. It stays
  governed by ADR 0131 Decision 1 and counsel's case-by-case rule; `dispose_case_phi`
  keeps erasing `patient_identifiers` / `answers` and keeps not touching ethics prose.
  ⛔ Nothing already ruled is reversed — in particular ADR 0131 Decision 4(a), *"discovering
  a failure never narrows a Decision-1 obligation"*, is untouched.

**4. No door and no UI will be built.** The absence of a `dispose_ethics_*` path is
henceforth a **recorded decision**, not an unfilled gap. ⛔ A future reader must not
re-derive it as missing work: `FUP-ETHICS-LANE-NO-ERASURE-DOOR` closed *by ruling*, and its
one preserved-open half closes here.

**5. ⚠ A request may still be MADE; what has no basis is GRANTING it.** Stated because the
ruling's phrasing ("no authority in permitting any parties from requesting") could be read
as barring intake, and that reading would itself be an LGPD problem — Art. 18 lets a data
subject ask, and a controller that cannot receive the request cannot answer it within the
statutory window. The platform's correct posture is the one ADR 0130 already builds:
**intake and adjudicate, then refuse**, with `outcome = 'refused_retention'`, an
`outcome_basis` citing this ADR, and the `legal_consultation_ref` the CHECK already
requires. What is ruled out is the **execution** half — there is no door because no grant is
available, not because no request may arrive.

**6. Two documents are corrected in the same change as this ADR** (both measured false
against the live catalog at head `20261003000300`, 2026-08-21):

- **ARCHITECTURE.md Rule 12** states *"there is **no `dispose_*` / erasure path** on
  `professional_profiles` (E1 ships none by design)"*. **`redact_professional_profile`
  exists**, is `SECURITY DEFINER`, is `EXECUTE`-granted to `authenticated`, answers over
  PostgREST, and carries pgTAP suite `257` plus E2E coverage. E1 shipped none; **E2 built
  it** and neither document was updated.
- **ADR 0072 §7 and Rule 12's basis** — corrected per Decision 2.

## The two live doors that contradict Decision 1

⛔ **Both are PRE-EXISTING and neither came from the DSR program.** Re-measured against the
live catalog: `ethics_` appears in **zero** of the four disposal doors; `dsr_tasks.kind`
admits six values, none ethics; and `dsr_requests.patient_key` is `NOT NULL` with no
subject-type column, so the DSR intake is **structurally patient-keyed** and an accused
professional cannot open a request at all. ⭐ *That last measurement corrects a claim this
program has repeated three times* — the follow-up and ADR 0131's Consequences both say ADR
0130 *"can adjudicate `granted` with no door to call"*. It cannot adjudicate such a request
either; there is nowhere to record the subject.

Both doors below were confirmed **by execution** in a transaction, rolled back, pre-state
re-verified.

**DOOR-1 — `DELETE FROM cases` cascades the whole evaluation away.** All seven case-scoped
`ethics_*` tables carry `case_id … REFERENCES cases(id) ON DELETE CASCADE`. `cases` grants
`authenticated` DELETE and its `cases_staff_admin_write` policy is `FOR ALL` to any
commission `staff_admin`. The only bound is `app.guard_case_status`, whose DELETE arm raises
only for `old.status in ('completed','cancelled')` — leaving `not_started`, `pending` and
`in_review`, i.e. **every in-flight proceeding**, deletable. ⭐ **The ethics lane's
deliberate write-lockdown is defeated by its parent**: each of the nine tables is granted
`select` and nothing else, and all writes go through fourteen DEFINER RPCs *none of which
contains a DELETE* — yet over HTTP `DELETE /rest/v1/ethics_case_details` returns **403
`42501`** while `DELETE /rest/v1/cases?id=eq.…` returns **200**. Audit: the statement emits
**3** rows (2 `case_access.revoked`, 1 `case.deleted`) and **none names any ethics entity**,
because no `ethics_*` table carries an audit trigger — a Rule 11 gap on this path.

**DOOR-2 — `redact_professional_profile` erases the respondent from an UNDECIDED case.** Its
`HC0J7` retention bar fires only when `retention_pinned_at is not null` **or** the professional
is a respondent in a case with an **`issued`** decision; and `app.trg_pin_respondent_retention`
fires only on the UPDATE transition **into** `status = 'issued'` on `case_decisions`. So
throughout intake, admissibility, findings and hearings the respondent is redactable. Gate:
`app.can_manage_professional` — platform_admin, org_admin, **or any commission `staff_admin`
in the org**. Measured: a plain `staff_admin` turned `Dra. Denunciada` / `CRM-9001` into
`Profissional (dados removidos)` / null on an open case. ⚠ **No UI calls it** — the server
action `redactProfessionalProfile` has zero callers in `src/` — but the UI's absence is not a
control: the RPC is `EXECUTE`-granted to `authenticated` and answers over PostgREST.

⭐ **The pin is at the wrong point relative to Decision 1.** ADR 0072 §7 keyed retention on a
*decided* case, which was coherent under its defensibility-of-the-decision rationale. Under
this ADR's rationale — the proceeding itself is the administrative record — the entitlement is
absent from **allegation-filing**, so the pin's trigger is one lifecycle stage too late.

**⛔ PO ruling on the two doors, 2026-08-21: RECORD ONLY — do not fix them in this change.**
Both are filed as open follow-ups with the measurements above. They are **accepted and open**,
not absent and not closed. Closing them is an RLS / gate change owing migrations, pgTAP
keystones and an ADR 0079 diff-scoped door sweep, and it is not being slipped into a
documentation change.

## Consequences

- The reserved Class-2 question **closes**; § Now's open item retires.
- The ethics lane is descoped from erasure on **two independent bases** now — 0131's
  no-designated-PHI-field reach bound, and this ADR's no-entitlement ruling. ⛔ They are not
  redundant: 0131's bound would evaporate the day a designated PHI column is added to the
  lane; this one would not.
- `DSR_RESIDUE_NOTICE` is **not** changed. Its premise (ADR 0131 Amendment 4) is unaffected —
  this ADR withholds a grant, it does not add retained content the notice fails to disclose.
- ⚠ **The platform now documents a non-erasable class whose two live removal paths are
  known and open.** That is a truthful state and a worse one than "no path exists"; it must
  be represented as such wherever the pilot risk acceptance is recorded, in the same register
  as ADR 0131's training premise.

## Rejected

- **Building a `dispose_ethics_case` door for symmetry with the other lanes.** There is no
  outcome it could execute; a door that may never be opened is an authorization surface with
  no compensating benefit.
- **Barring DSR intake of a request naming an ethics record** (Decision 5) — refusing to
  receive is not the same as refusing to grant, and only the second is defensible.
- **Blocking `dispose_case_phi` on ethics-typed cases** (the wider reading of Decision 3) —
  it would reverse counsel's case-by-case holding and ADR 0131 Decision 1's mandatory
  Class-1 obligation. Put to the PO explicitly and not taken.
