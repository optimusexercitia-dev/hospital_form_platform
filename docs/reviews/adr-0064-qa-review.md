# QA Review — ADR 0064 (Case subject generalization: participants, professional registry, case types)

**Reviewer:** qa · **Date:** 2026-07-09 · **Artifact under review:** design ADR only (phase E0
foundation; nothing implemented). Read-only audit against ARCHITECTURE.md Rules 1/2/10/11/12 and
ADRs 0038, 0033, 0030, 0035, 0037, 0054.

**Verdict:** **CHANGES REQUESTED** — the design is sound and the four product-owner decisions are
faithfully captured, but there are two MAJOR reconciliation/consistency gaps that will cause a
future implementer to guess or diverge, plus fixable MINORs. None is a security hole in the design
itself; the blockers-to-implementation are documentary precision issues an E0 engineer must not
have to reverse-engineer.

---

## Requirements & product-owner-decision fidelity

The four decisions taken with the PO (evaluation §8) map cleanly onto the ADR:

- **A1 full participant model** → Decision 1 (`participants` + `case_participant_roles` +
  `case_participants`, subtype tables, no polymorphic FKs). ✓
- **Professional identity as its own audited class** → Decision 2. ✓
- **`case_patient` 1 → N** → Decision 3. ✓
- **Dedicated `case_types` table (not a column on `process_templates`)** → Decision 4, and it
  correctly resolves the evaluation's open question #3 (§8.3) in favor of a real table. ✓

The ADR also correctly *rejects* the source doc's naïve elements it must not regress to: the
`committee_cases` rebuild (source §20), `email_encrypted`/`notes_encrypted` plaintext columns
(source §6.2.3), and a flat `audit_events` table (source §15). Consistent with evaluation §5.

---

## Findings

### BLOCKER
_None._ The design does not introduce a PHI/professional-data leak, does not put payloads or PHI
in the audit log (Decision 2 and Decision 3 both specify PHI-free/metadata-only audit, Rule 11),
and RLS remains the boundary (Rule 1). Nothing here is a phase-blocking security defect at the
design tier.

### MAJOR

**M1 — Rule 12 amendment is under-specified and collides with the *existing* Rule 12 wording; a
future implementer cannot reconcile it from this ADR alone.**
ARCHITECTURE.md Rule 12 today is written entirely as an *enumeration of three PHI modules*
("PHI now lives in the NSP, referral, **and case** modules"; then a "Third PHI module" bullet).
ADR 0064 reframes the axis to *two sensitivity classes* (patient PHI vs professional identity) and
says Rule 12 "grows from 'PHI in three modules' to 'patient PHI … and professional identity …'."
But:
  - The prompt's framing ("two → three PHI modules now reframed as patient PHI + professional
    identity classes") is **not** what the ADR literally writes. The ADR still leaves the *three
    patient-PHI modules* (NSP, referral, case) intact and adds professional identity as a *second
    class* beside them. That is the correct design — but the ADR's own prose ("Rule 12 grows from
    'PHI in three modules'") is ambiguous about whether the three-module enumeration survives.
    It must survive (patient PHI is still isolated in exactly those three places); the "class"
    reframing is an *additional* axis, not a replacement of the module count.
  - The ADR does **not** quote or diff the actual Rule 12 text it amends. Rule 12 has a specific
    closing sentence, "Modules that don't need patient identity hold none by design," and a
    per-module bullet structure. A future engineer editing ARCHITECTURE.md needs to know: does
    professional identity get its own Rule-12 bullet (parallel to the three "Nth PHI module"
    bullets)? Does the CLAUDE.md §3 Rule-12 summary ("PHI lives in exactly two modules") — which
    is *already stale* (it says two; Rule 12 says three) — get touched? The ADR should state the
    intended final shape of the Rule 12 text, not just its intent.
  - **Action:** add a short "Rule 12 — intended final wording" block to the ADR that (a) preserves
    the three patient-PHI-module enumeration, (b) adds professional identity as a named *second
    sensitivity class* with its lighter checklist (case-scoped RLS + audited read, no
    isolated-single-door, no reveal-on-demand, no disposal-erasure requirement — or state
    explicitly whether LGPD Art. 18 erasure applies to `professional_profiles`; see M2), and
    (c) flags that CLAUDE.md §3's "exactly two modules" summary line is stale and must be
    reconciled at implementation. Without this, E0 will either mis-edit Rule 12 or leave the
    stale "two modules" line contradicting a now-two-sensitivity-classes world.

**M2 — LGPD erasure / retention posture for `professional_profiles` is unspecified — a real gap
for a *disciplinary* record.**
Decision 2 gives professional identity "audited reads but not the full patient-PHI apparatus (no …
disposal … )". For patient PHI, `dispose_case_phi` is the LGPD Art. 18 mechanism (ADR 0035, and
the parity gap for referrals has since been closed — `dispose_referral_phi` now exists in
`20260711000700_phi_disposal_closure.sql`). Professional identity is **LGPD personal data** (ADR
0035 Art. 11 governs *sensitive* health data specifically, but ordinary personal data still
carries Art. 18 correction/erasure rights). The ADR is silent on:
  - Whether a respondent doctor can exercise correction/erasure against `professional_profiles`,
    and how that reconciles with CFM 20-year retention of a *disciplinary* record (a doctor found
    to have committed misconduct has a strong institutional-defensibility argument *against*
    erasure — this is a genuine legal tension the ADR waves past with "no … disposal").
  - Whether `affiliation_status = 'former'/'external'` professionals get any retention treatment.
  This does not have to be *solved* in E0, but the decision "professional identity gets no
  disposal path" is a substantive LGPD/CFM posture choice that should be **explicitly stated and
  deferred to a named phase (E1/E2)**, not left as an unremarked consequence of "lighter class."
  As written, a future implementer will reasonably assume no erasure is ever needed and ship a
  disciplinary registry with no correction/erasure story — a defensibility and LGPD gap.

### MINOR

**m1 — `sensitivity_class` on `participants` is introduced but never defined.** Decision 1 lists
`sensitivity_class` as a column on `participants`, and Decision 2 names two classes (patient PHI,
professional identity), but the schema sketch does not enumerate the allowed values, nor state how
`sensitivity_class` relates to the participant's `participant_type` (is it derived? independent?
does an `affected_patient` participant carry `sensitivity_class = patient_phi`?). Since this column
is the hook a security reviewer would use to know *which* isolation checklist applies to a row,
its value domain and its relationship to `participant_type` should be pinned before E0.

**m2 — Respondent-exclusion deferral is present but the *risk* is under-stated.** The ADR defers
"respondent-exclusion" to E1 open item 1 and marks E1 a "Prerequisite for storing any real
complaint data," which is the correct gate. Good. However, the specific failure mode — *a
respondent doctor who is also a platform user (`professional_profiles.user_id` set) and a member
of the Ethics Committee reading their own case via the broad `can_read_case`* — is exactly the
kind of leak Rule 1 exists to prevent, and E0 *ships the `user_id` linkage* that makes it
reachable. The deferral is legitimate (E0 is dark behind flags, no real data), but the ADR should
add an explicit **guardrail note**: E0 must not flip the `case_participants`/`case_types` flags in
any environment holding real ethics data until E1's respondent-exclusion RLS lands. As written the
dependency is implied, not stated as a hard gate. (Confirmed the concern is *deferred, not
dropped* — it appears verbatim in open item 1 — so this is a hardening note, not a blocker.)

**m3 — Open item 5 (`case_interview_subjects` reconciliation) is already partially overtaken by
the codebase.** The ADR lists reconciling `case_interview_subjects` with case-level participants
as an open item "migrate/alias vs leave parallel." Note for the implementer: a
`20260713001200_case_interviews_case_scope_read.sql` migration already exists that case-scopes
interview reads to `can_read_case`. Whoever picks up open item 5 should account for that already-
landed case-scoping so the participant migration doesn't regress it. Not an ADR defect — a
freshness note so the deferral isn't planned against a stale baseline.

**m4 — `patient_participants` PK/key chain in the schema sketch is internally inconsistent.** The
sketch shows both `patient_participants(participant_id PK → participants, …)` and
`patient_identifiers(participant_id PK → patient_participants, …)`. The prose (Decision 3) says
`patient_identifiers(participant_id PK → participants …) reachable only … via
patient_participants`. The two spots disagree on whether `patient_identifiers.participant_id` FKs
to `participants` or to `patient_participants`. Trivial to fix, but the REVOKE/door isolation
argument rests on this chain being exact, so it should be unambiguous before E0 writes the
migration.

### INFO

**i1 — The "professional identity ≠ patient PHI" sensitivity split is defensible under LGPD + CFM.**
A doctor-under-review is *dado pessoal* (LGPD Art. 5) but not *dado pessoal sensível de saúde do
titular* in the patient sense (ADR 0035 Art. 11 is about the patient's health data). Case-scoped
RLS + audited reads is a proportionate control for identity the case-workers must routinely see;
over-applying the reveal-on-demand/single-door patient machinery would be friction the data class
doesn't warrant. The ADR's rationale (Decision 2) is sound. The one thing that *raises* the bar —
that this is a **disciplinary** record — is addressed by keeping audited reads (defensibility),
and is only incomplete on the erasure/retention axis (M2).

**i2 — "One Case model, never forked" is the right call and consistent with the platform.** The
rejection of `patient_cases`/`ethics_cases` roots (Decision, "One generalized Case model") matches
the evaluation's central finding that `cases` already *is* the generic root, and avoids forking
audit/ACL/documents/referrals per committee. No concern.

**i3 — Tenancy anchoring, feature-flag dark-launch, and `case_access` extension are all
consistent with existing patterns** (ADR 0054 composite-FK tenancy exists; the flag discipline
mirrors `case_patient`/`case_referrals`; `case_types.default_visibility_policy` is correctly
scoped as *defining the column only*, wiring deferred to E1). No concern.

**i4 — pgTAP obligations are enumerated (Consequences) and match the isolation keystones**
(professional-read audited + case-scoped; patient door NULL-out-of-scope with N patients;
primary-subject partial-unique; cross-tenant participant isolation; disposal removes all patient
satellites). Good acceptance scaffolding for E0.

---

## Completeness / premature-closure assessment

The ADR defers the **right** things and scopes E0 correctly: it explicitly walls off the ethics
*procedure* (allegations/findings/votes/hearings/appeals) and the confidentiality/recusal/COI RLS
spine to E1/E2 (Non-goal + Open items 1–2), which is the correct dependency order (the evaluation's
§7 warning: access spine before real complaint data). Open items 3–5 (form participant targeting,
assignment-role vocabulary, interview-subject reconciliation) are genuinely optional-for-E0 and
each carries enough context for a different engineer to resume. The gaps that *would* cause rework
are M1 (Rule 12 final wording) and M2 (professional erasure/retention decision) — both are
decisions left implicit that a future session would otherwise have to re-litigate.

**To move to APPROVED:** resolve M1 and M2 in the ADR text (state the intended final Rule 12
shape incl. the stale-CLAUDE.md-summary reconciliation; state and phase-defer the
professional-identity erasure/retention posture), and fix m1/m4 (define `sensitivity_class` value
domain; make the `patient_identifiers` FK chain consistent). m2/m3 are hardening/freshness notes.
