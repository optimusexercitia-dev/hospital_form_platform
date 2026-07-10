# Case Generalization — Platform Evaluation & Ethics-Committee Gap Analysis

**Purpose.** Evaluate the external team's data model
(`docs/design/temp/case_generalization_chatgpt.md`) against **what our platform already
is**, then derive the concrete feature set we'd need to support the **Ethics Committee**
(a case centered on a **medical professional**, not a patient) and other non-patient-centered
committees.

**Author's note on the source doc.** The external design is well-reasoned, but it was written
against an *assumed* baseline — "a patient-centered platform: assign a patient case → fill a
form → discuss in a meeting" — and its central recommendation is *"stop modeling a case as
belonging to a patient; model it as having participants with roles."* **We already crossed
that bridge.** Our `cases` table is not `patient_cases`; it is a generic committee-matter root
with an optional, flag-gated, PHI-isolated `case_patient` satellite. So most of the doc's
"core generalization" is **already done**, and the *real* work for Ethics is narrower and more
specific than the doc implies. The parts of the doc that remain genuinely valuable are the
**participant/role abstraction**, the **professional registry**, and the **ethics workflow
extensions** (allegations, findings, notifications, hearings, votes, sanctions, appeals,
recusals, conflicts).

---

> **Status (2026-07-09).** The four foundational decisions in §8 are now **made** (product owner)
> and recorded in ADR [0064](../decisions/0064-case-subject-generalization-participants.md):
> full generic participant model · professional identity as its own audited class · `case_patient`
> generalized to N-per-case · dedicated `case_types` table. This doc stays the **evaluation +
> comparison**; ADR 0064 is the **binding decision** (E0 foundation). Access spine (E1) and ethics
> procedure (E2) are deferred to their own ADRs. Pending-work tracker: `PROGRESS.md` → Follow-ups.
> **Not implemented** — to be continued in a future session.

## 1. TL;DR

| | |
|---|---|
| **Do NOT do** | Rip out `cases` and rebuild as `committee_cases`. The doc's §20 migration ("`patient_cases → committee_cases`") targets a table we never built. Our `cases` root already **is** `committee_cases`. |
| **Biggest single gap** | The **subject of a case is patient-only** (`case_patient`, 8 fixed patient identifiers). Ethics needs the primary subject to be a **doctor**, plus **multiple participants with roles** (complainant, witness, respondent, legal rep). This is the one structural change everything else hangs off. |
| **Second gap** | No **professional registry** — a doctor-under-review who may not be a platform user (external, former employee, contractor). Today the closest thing is a throwaway `case_interview_subjects.external_name`, scoped to a single interview. |
| **Third gap** | The **ethics procedure** (admissibility → notification → allegations → investigation → hearing → deliberation → **vote** → decision/**sanction** → **appeal**) has no home. Our phase/narrative engine can carry *some* of it, but allegations, votes, sanctions, recusals, and conflict-of-interest declarations need first-class tables. |
| **Where we're already ahead of the doc** | Hash-chained tamper-evident **audit trail** (multi-tier), **PHI isolation + LGPD disposal** across 3 modules, per-case **ACL** (`case_access`), **inter-committee referrals**, indicators, controlled documents, feature-flag gating, real LGPD/ANVISA/CFM grounding. Don't regress to the doc's naïver versions of these. |
| **Recommended shape** | *Adapt, don't rebuild.* Generalize the case **subject** into a typed participant model, add a **professional registry**, add a light **case-type/terminology** layer (can ride on `process_templates`), and add **ethics extension tables** behind a feature flag — reusing our established satellite + audited-door + RLS + audit patterns. |

---

## 2. What our platform already is (the corrected baseline)

The external doc's "reusable workflow" (its §24) — *open a matter → attach participants →
collect evidence → assign members → complete structured forms → discuss/hear → record a
decision → generate action items → close → preserve an audit trail* — is a fair description of
**our existing engine**, with one hole (participants). Concretely:

- **Root entity `cases`** — per-commission, minted case number, fixed state machine
  (`nao_iniciado → em_revisao → pendente → concluido / cancelado`, auto-computed from phases).
  **Not** patient-hardwired.
- **`process_templates` + `process_template_phases`** — the committee configures a template;
  a case is instantiated from it. This is our equivalent of the doc's
  `case_workflow_templates` / `case_workflow_stages`, **but richer**: each phase is assigned to
  a member and is either a **Form** (a `response`) or a **Narrative** (free-form authored
  text), with **phase results**, **auto-recommendation** of later phases from earlier phases'
  answers *or results* (ADR 0043), and per-phase due dates.
- **Subject = optional `case_patient`** (ADR 0038) — 8 fixed patient identifiers, PK =
  `case_id`, **PHI-isolated** (all DML revoked; audited single-door `get_case_patient`;
  reveal-on-demand), per-template `collects_patient` toggle, LGPD disposal (`dispose_case_phi`).
- **`case_documents`** (immutable bucket, soft-delete) + **`case_events`** (timeline, kind
  incl. `interview`, with occurred date/time).
- **Meetings** module (`committee_meetings`, `meeting_cases`, minutes, actual occurrence time)
  and **Interviews** module (case-scoped; `case_interviews` + `case_interview_subjects`).
- **Unified `action_items`** (case / CAPA / indicator sources; ADR 0050).
- **`case_access`** — per-case read/write ACL with expiry (ADR 0033), attribution-driven read
  (assignees auto-read), restrictive `can_read_case` boundary, "Meus Casos".
- **Audit trail** — append-only, **hash-chained, tamper-evident**, multi-tier
  (org/hospital/commission), PHI-read auditing, `verify_audit_chain` (Rule 11).
- **PHI**: three isolated satellites — `event_patient` (NSP), `referral_patient` (referrals),
  `case_patient` (cases) — each audited-single-door + LGPD disposal; column encryption
  deliberately declined (ADR 0035).
- **Inter-committee referrals** (ADR 0037) — send a frozen point-in-time snapshot of a case to
  another committee, structured reply, QPS sees the full trajectory.
- **Accreditation track** — NSP events → triage → RCA → CAPA, quality indicators, controlled
  documents; standards crosswalk planned (Phase 16).
- **Multi-tenant** org → hospital → commission; roles admin/org_admin, hospital_admin,
  nsp_org_admin, nsp_coordinator, staff_admin, staff, PQS members, + delegated "Administrativo"
  capabilities. **Feature-flag** gating for every dark-launched module.

**One partial participant model already exists** and is worth noting: `case_interview_subjects`
carries `user_id XOR external_name` + `external_org` + `clinical_role` + `note`. That is a
person-who-may-not-be-a-user — but it is **interview-scoped, non-reusable, and has no license
identity**. It is the seed of, not a substitute for, the participant model Ethics needs.

---

## 3. Feature-by-feature comparison

Legend — **Present** (we have an equivalent, often stronger) · **Partial** (exists but scoped
narrower than Ethics needs) · **Absent** (no equivalent).

### 3.1 Core case engine

| External-doc concept | Our equivalent | Status | Notes |
|---|---|---|---|
| `committee_cases` (generic root) | `cases` | **Present** | Already generic; not patient-bound. The doc's rename migration is moot. |
| `case_types` (config: label, default visibility, terminology) | `process_templates` (per-commission) | **Partial** | Templates carry workflow, but there's no cross-cutting *case-type* identity, no default-visibility policy, no terminology overrides. |
| `case_type_terminology` (per-type UI labels) | — | **Absent** | UI says "Caso / Paciente" everywhere. Ethics needs "Denúncia / Médico". |
| `case_workflow_templates` / `case_workflow_stages` | `process_templates` / `process_template_phases` | **Present (stronger)** | Ours adds per-phase assignee, form-vs-narrative, results, auto-recommendation, due dates. |
| `case_status_history` | `audit_log` (case.* verbs) + auto-computed status | **Partial** | We audit status changes and recompute status, but there's no dedicated queryable status-history projection with reason/on-hold semantics. (We *had* a configurable-status table; dropped in ADR 0024.) |
| Soft deletes on sensitive entities | `deleted_at` on `case_documents`; PHI **disposal** RPCs | **Present** | We go further: true LGPD erasure paths, not just soft-delete. |

### 3.2 Participants & identity — **the core gap**

| External-doc concept | Our equivalent | Status | Notes |
|---|---|---|---|
| `participants` (unified person/entity) | — | **Absent** | No case-level participant identity. |
| `case_participants` (participant × role × case) | `case_interview_subjects` (interview-scoped only) | **Absent** at case level | Interview subjects don't attach to the case as a whole, and aren't reusable. |
| `case_participant_roles` (respondent, complainant, witness…) | — | **Absent** | No role vocabulary. |
| `professional_profiles` (doctor as non-user, w/ CRM/license) | — | **Absent** | **Critical for Ethics.** `case_interview_subjects.external_name` is throwaway text. |
| `patient_participants` | `case_patient` (0..1, PHI-isolated) | **Partial** | We have *the patient as subject*, but as a single fixed satellite, not as one participant among many with a role. |
| `external_person_participants` (complainant, witness, legal rep) | — | **Absent** | |
| `department_participants` / `institution_participants` (dept, CRM/CFM, legal entity) | — | **Absent** | Needed for "refer to medical board / legal". |
| One-primary-subject-per-case | implicit (the case) / `case_patient` | **Partial** | No explicit primary-subject designation among participants. |

### 3.3 Assignments, forms, meetings, documents, timeline, action items

| External-doc concept | Our equivalent | Status | Notes |
|---|---|---|---|
| `case_assignments` (reviewer/investigator/chair…) | `case_phases` (assigned to a member) | **Present (stronger)** | Our assignment carries the actual work unit (a form/narrative) + result, not just a role label. Missing: an *assignment-role* vocabulary (investigator vs reviewer vs chair). |
| Shared form engine, `form_template_case_types` | forms + `process_template_phases` | **Present / Partial** | Forms are reused via phases. There's no `case_type → allowed form templates` mapping, but templates already scope which forms appear. |
| `form_responses.target_participant_id` | — | **Absent** | Needed for "Witness Interview Form about *this* witness", "Respondent Statement Review about *this* doctor". Today a response attaches to a phase, not a participant. |
| `case_documents` (+ types, visibility_scope) | `case_documents` | **Present / Partial** | We have the table + immutable bucket; **missing** per-document `visibility_scope` (deliberation-only, legal-privileged) and `confidentiality_level`. |
| `case_document_access_grants` (doc-level ACL) | `case_access` (case-level only) | **Absent** at doc level | Ethics wants "reviewer sees the case but not the legal correspondence". |
| `case_timeline_events` (clinical + procedural) | `case_events` | **Present / Partial** | Ours is a general timeline already; **missing** the procedural categories (deadline, legal/procedural, notification) and per-event visibility scope. |
| `committee_meetings` / `meeting_agenda_items` / `meeting_case_discussions` | Meetings module | **Present (stronger)** | We have meetings, case-agenda, minutes. Missing: meeting *type* = hearing/deliberation/appeal (see §3.4). |
| `case_votes` | — | **Absent** | No formal voting record. |
| `action_items` (generic, participant-linked) | unified `action_items` | **Present / Partial** | Present; **missing** `related_participant_id` (action about the respondent/complainant). |

### 3.4 Decisions & the ethics procedure — mostly **Absent**

| External-doc concept | Our equivalent | Status | Notes |
|---|---|---|---|
| `case_decisions` (typed conclusion + rationale) | phase results + narrative + `concluida` lifecycle | **Partial** | We conclude cases and record phase results, but there's no first-class *decision* with a decision-type vocabulary, draft→issued status, or decided_by. |
| `ethics_case_details` (complaint source, admissibility, response deadlines, appeal window) | — | **Absent** | |
| `ethics_case_allegations` (multiple, per-allegation status) | — | **Absent** | A complaint = many allegations, each with its own finding. Can't flatten to one text field. |
| `ethics_case_findings` (finding per allegation) | — | **Absent** | |
| `ethics_decision_details` (sanction type, remediation, external reporting to CRM/CFM, decision letter, appeal deadline) | — | **Absent** | |
| `ethics_case_notifications` (respondent notified, response due, hearing notice) | — | **Absent** | Deadlines are a defensibility requirement; can't live in notes. |
| `ethics_hearings` (formal, more than a meeting) | Meetings (generic) | **Absent** | Could layer on a meeting + `meeting_type`, but hearing-specific metadata (who was present, outcome) has no home. |
| `ethics_appeals` | — | **Absent** | Affects finality, deadlines, reporting. |

### 3.5 Access, confidentiality, conflicts — **the security-sensitive gap**

| External-doc concept | Our equivalent | Status | Notes |
|---|---|---|---|
| `case_access_grants` (per-case explicit grants) | `case_access` (ADR 0033) | **Present** | We already have per-case read/write grants with expiry, RLS-enforced. |
| Default `explicit_grants_only` per case-type | `case_access` + restrictive `can_read_case` | **Partial** | Mechanism exists; **missing** a per-case-type *default* that makes Ethics cases invisible to committee members absent an explicit grant, and a rule that **excludes the respondent doctor** from their own case. |
| `confidentiality_level` (standard → legal_privileged) | — | **Absent** | No confidentiality marker on cases/documents. |
| `case_conflict_declarations` (COI attestation) | — | **Absent** | Ethics requires a defensible COI record before review/vote. |
| `case_recusals` (recused → excluded from read/vote) | — | **Absent** | Must be RLS-enforced, not UI-only. |
| RLS as the security boundary | RLS everywhere (Architecture Rule 1) | **Present** | Our posture already matches the doc's §14.4 recommendation; we just need to fold recusal/COI/confidentiality into the predicates. |
| `audit_events` (writes + sensitive reads) | `audit_log` (hash-chained, PHI-read audited, multi-tier) | **Present (much stronger)** | The doc's plain `audit_events` is a subset of what we ship. Ethics read-auditing is already covered by `log_audit_access`. |

### 3.6 Committee-specific extension tables (M&M etc.)

| External-doc concept | Our equivalent | Status | Notes |
|---|---|---|---|
| `mm_case_details` / `mm_contributing_factors` / `mm_preventability_assessments` | NSP: event → triage → RCA (fishbone/5-Whys) → CAPA | **Present (different shape, stronger)** | We already model M&M-style patient-safety analysis richly via the NSP module — arguably more mature than the doc's M&M tables. Preventability/contributing-factors live in triage/RCA. |

---

## 4. Gap analysis for the Ethics Committee (and other non-patient committees)

Grouped by what actually has to be built, in dependency order.

### Group A — Generalize the case *subject* (foundational; everything else needs it)

The platform's current axiom is **"the subject of a case is a patient (optional, PHI)."**
Ethics breaks it: the subject is a **doctor**, and there are **several other people** attached
(complainant, affected patient, witnesses, legal rep). Two viable designs:

- **A1 — Full participant model (the doc's recommendation).** Add `participants` +
  subtype tables + `case_participant_roles` + `case_participants`. General, future-proof
  (credentialing, risk, sentinel review all benefit), but a larger build and a new PHI surface
  to reason about (affected-patient participants are still PHI and must reuse the isolated-
  satellite discipline, not the doc's hand-wavy `email_encrypted` columns).
- **A2 — Mirror the satellite pattern (`case_professional`).** Add a `case_professional`
  satellite modeled field-for-field on `case_patient` (the doc's own §16/§17 pattern applied
  to the doctor), plus a lightweight `case_participants` for the *other* people. Smaller,
  maximally consistent with ADR 0038, ships fast behind a flag; less general.

**Recommendation:** **A1**, but *implemented in our idiom* — the participant table is
generic **identity + role**, and any PHI-bearing subtype (affected patient) routes through the
existing `case_patient`-style isolation and disposal, not new plaintext columns. This keeps the
Rule 12 PHI posture intact while unlocking non-patient subjects. Treat A2 as the fast-pilot
fallback if timeline pressure demands it. **Design decision → new ADR.**

Concrete pieces:

1. **`professional_profiles`** — doctor/professional as a first-class, **reusable, non-user**
   entity: `full_name`, `professional_type`, `license_number` (CRM), `license_region`,
   `specialty`, `affiliation_status`, optional `user_id`. Note: a doctor-under-review is
   **personal data under LGPD** but *not patient health PHI* — a distinct sensitivity class we
   should name explicitly (don't overload the patient-PHI machinery, but do audit access).
2. **`participants` + `case_participants` + `case_participant_roles`** — attach participants to
   a case with a role (`respondent_doctor`, `complainant`, `affected_patient`, `witness`,
   `investigator`, `legal_representative`, `external_regulatory_body`). One `is_primary_subject`.
3. **Reuse `case_patient` for affected-patient participants** — don't invent a second PHI path.

### Group B — Case-type & terminology (light, high UX leverage)

4. **Case-type identity** — either a real `case_types` row or a `kind`/`category` on
   `process_templates` (cheaper, rides existing config). Carries: default visibility policy,
   primary-subject kind (patient vs professional), and a terminology bundle.
5. **Terminology overrides** — so Ethics screens read *Denúncia*, *Médico denunciado*,
   *Cronologia processual* instead of *Caso*, *Paciente*, *Linha do tempo*. All UI strings stay
   pt-BR (Rule 10); this just selects which pt-BR label set a case-type renders.

### Group C — Ethics procedure (extension tables behind an `ethics` flag)

6. **`ethics_case_details`** — complaint source, admissibility status + decision, respondent-
   notified/response-due/received, hearing-required, appeal window, external-reporting flags.
7. **`ethics_allegations`** (many per case) + **`ethics_findings`** (per allegation).
8. **`ethics_notifications`** — formal notices with deadlines (acknowledgement, respondent
   notice, request-for-response, hearing notice, decision notice, appeal notice). Feeds the
   procedural timeline and audit.
9. **`case_decisions`** (generic) + **`ethics_decision_details`** — sanction type (verbal/
   written warning, mandatory training, supervised practice, restriction, **referral to CRM/
   CFM**, termination recommendation), remediation, external-reporting-to-medical-board,
   decision letter, appeal deadline. **Note the Brazilian angle:** external reporting targets
   are **CRM / CFM**, not a generic "medical board" — model the target explicitly.
10. **`ethics_hearings`** — layer on a meeting (`meeting_type = ethics_hearing / deliberation /
    appeal`) + hearing-specific metadata (attendance, outcome).
11. **`case_votes`** — formal deliberation record (approve/reject/abstain/recused), tied to a
    decision and meeting. Reusable for credentialing later.
12. **`ethics_appeals`** — appeal lifecycle affecting finality/deadlines.

Much of 6–12 could *start* as **Narrative phases + forms** in a process template (our engine
already carries structured per-phase data), then graduate to dedicated tables where we need
querying, deadlines, or defensibility (allegations, votes, notifications, appeals). Don't build
all twelve as tables on day one — see §6 sequencing.

### Group D — Access, confidentiality, conflicts (must precede real complaint data)

13. **`case_confidentiality_level`** on cases (and optionally documents) — standard →
    restricted → highly_restricted → legal_privileged.
14. **Per-case-type default visibility** — Ethics defaults to *explicit-grants-only*; a member
    of the Ethics Committee does **not** automatically see every complaint. Mechanism (`case_access`
    + restrictive `can_read_case`) exists; we need the default wired to case-type.
15. **Respondent-exclusion rule** — the doctor under review (if a platform user) must be denied
    access to their own case unless explicitly granted. RLS predicate.
16. **`case_conflict_declarations`** + **`case_recusals`** — COI attestation and recusal, both
    **enforced in RLS** (a recused user loses read/review/vote). This is the doc's §14.2–14.3,
    and it's non-negotiable for defensible ethics review.
17. **Document-level access grants** (`case_document_access_grants`) — deliberation-only /
    legal-privileged files invisible even to case-readers. Extends `case_access` to the object.

The doc's §14.4 RLS checklist (org membership → hospital/committee access → not soft-deleted →
visibility policy → explicit grant when required → **not recused** → not the respondent →
confidentiality allows the operation) is a good acceptance spec for the Ethics `can_read_case`
predicate. We already satisfy items 1–5; **6–8 are the new work.**

---

## 5. Where we already exceed the external design (don't regress)

When implementing, keep our stronger mechanisms rather than adopting the doc's simpler ones:

- **Audit** — ship the doc's read/write events *through* our hash-chained `audit_log`
  (`log_audit_access`), not a fresh flat `audit_events` table. Tamper-evidence is a Rule-11
  requirement and an accreditation asset (ALCOA+).
- **PHI** — affected-patient and any sensitive contact data go through **isolated satellites +
  audited single doors + LGPD disposal**, not the doc's `email_encrypted` / `notes_encrypted`
  plaintext-with-a-suffix columns. Column encryption is deliberately declined (ADR 0035);
  don't reintroduce it by the back door.
- **Access** — extend the existing `case_access` ACL rather than inventing a parallel grant
  table; add recusal/COI/confidentiality as **predicates folded into `can_read_case`**.
- **Workflow** — prefer our **process-template + phase + result + recommendation** engine over
  the doc's flat `case_workflow_stages`; the stages map onto phases, and we get assignment,
  forms/narratives, and auto-recommendation for free.
- **Referrals** — "refer to legal / refer to another committee" partly exists already
  (ADR 0037 inter-committee referrals); reuse it for ethics→legal/CRM hand-offs where it fits.

---

## 6. Recommended approach & sequencing

**Principle: adapt, don't rebuild.** The `cases` root stays. We layer a subject/participant
generalization and an ethics module on top, behind an `ethics` (and `case_participants`) flag,
reusing every established pattern (satellite isolation, audited doors, RLS predicates,
hash-chained audit, feature flags, per-template config).

**Phase E0 — Foundations (unlocks all non-patient committees).**
`professional_profiles`; `participants` + `case_participants` + `case_participant_roles`;
case-type/terminology (on `process_templates`); wire the "primary subject kind" so a case can
be professional-centered. New ADR for the subject-generalization decision (A1 vs A2).

**Phase E1 — Ethics access spine (before any real complaint data — the doc's §7 warning).**
Confidentiality levels; per-case-type explicit-grants-only default; respondent-exclusion RLS;
`case_conflict_declarations` + `case_recusals` folded into `can_read_case`; document-level
access grants. pgTAP isolation tests mirroring our NSP keystones.

**Phase E2 — Ethics procedure (structured).**
`ethics_case_details`, `ethics_allegations` + `ethics_findings`, `ethics_notifications`
(deadlines), `case_decisions` + `ethics_decision_details` (sanctions, CRM/CFM referral),
`case_votes`, `ethics_hearings`, `ethics_appeals`. Some of these can debut as narrative/form
phases and graduate to tables as querying/deadline needs prove out.

**Phase E3 — Terminology & UX polish + accreditation linkage.**
Ethics-specific labels, procedural-timeline categories, dashboards; link ethics decisions/CAPA
to the standards-crosswalk (Phase 16) as evidence.

**Feature-flag discipline:** everything ships **OFF**, dark until an in-phase flip, exactly
like `audit_trail` / `patient_safety` / `case_access` / `case_referrals` / `case_patient`.

---

## 7. Beyond Ethics — what the same work unlocks

Group A (participants) + Group C-style extensions generalize cleanly to other **non-patient-
centered** committees the doc names, all of which our current patient-subject axiom blocks:

- **Credentialing / privileging** — subject = professional; reuses `professional_profiles`,
  `case_votes`, decisions/sanctions.
- **Risk management / legal** — subject = incident/claim; participants = claimant, staff,
  institution, legal entity; confidentiality + doc-level ACL.
- **Ethics research / COI** — subject = professional or protocol.
- **Sentinel-event review** — already close via NSP, but participant roles enrich it.

The strategic payoff is exactly the doc's closing thesis, and it's the *right* one — we're just
much closer to it than the doc assumed: **a general hospital-committee case-management platform,
patient-centered where the domain requires it, professional- or entity-centered where it
doesn't.**

---

## 8. Open decisions for the human — RESOLVED 2026-07-09 (→ ADR 0064)

All four were decided with the product owner and are binding in
ADR [0064](../decisions/0064-case-subject-generalization-participants.md):

1. **A1 (full participant model) vs A2 (satellite-first)** → **A1**, the full generic
   participant model, built in our RLS/satellite/audit idiom.
2. **Is a doctor-under-review "PHI-grade"?** → **Its own audited sensitivity class** —
   case-scoped RLS + audited reads, *not* the patient-PHI isolated-single-door machinery.
3. **`case_types` as a real table vs a column on `process_templates`** → **Dedicated
   `case_types` + `case_type_terminology` table** (org-scoped).
4. **`case_patient` cardinality** → **Generalize to N per case**, re-keyed to the participant
   layer (`patient_identifiers(participant_id)`), reworked while the flag is OFF.

Remaining sub-decisions (form-response participant targeting, assignment-role vocabulary,
reconciling `case_interview_subjects`, and how much of the ethics *procedure* starts as
phases vs tables) are carried in ADR 0064 §"Open items" and the E1/E2 phases.
