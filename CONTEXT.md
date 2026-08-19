# Hospital Commission Forms Platform

A governance and quality layer for hospital accreditation. It documents how commissions
run their process, take their measurements, and drive their improvements. It sits beside
the EHR and deliberately does not duplicate it.

> **Stub.** Seeded from `CLAUDE.md` §1 and the module areas under `src/lib/`. It is a
> glossary and nothing else: no schema, no implementation notes, no decisions (those are
> ADRs in `docs/decisions/`). Sharpen it with the `domain-modeling` skill as terms come up,
> rather than filling it in speculatively.

## Language

### Tenancy and identity

**Organization**:
The top of the tenancy. A hospital network that owns one or more Hospitals.
_Avoid_: tenant, account, client, network

**Hospital**:
A single site belonging to one Organization. Hospitals own Commissions.
_Avoid_: unit, facility, site, branch

**Commission**:
The lowest unit of ownership, e.g. Infection Control. Every Form, Member, and Response
belongs to exactly one Commission. It is the thing this platform exists to serve.
_Avoid_: committee, department, team, group

**Membership**:
A person's grant of a Role at one scope: an Organization, a Hospital, or a Commission.
One person may hold different Roles at different scopes.
_Avoid_: commission member, assignment, enrolment, seat

**Affiliation**:
The link between a person and the Hospital they work at. Distinct from Membership: it
describes where someone is, not what they may do.
_Avoid_: attachment, posting, assignment

### Roles

**Staff**:
A Commission member who fills published Forms.
_Avoid_: user, respondent, filler

**Staff Admin**:
A Commission member who builds and edits its Forms, manages its Staff, and reads its
dashboard.
_Avoid_: owner, manager, editor

**Administrativo**:
A delegated capability granted per Commission, not a Role. Someone holds it in addition
to their Role.
_Avoid_: administrator, admin role, secretary

**NSP** (_Núcleo de Segurança do Paciente_):
The patient-safety nucleus. Runs the patient-safety roster and the event-to-CAPA loop,
with its own Roles that sit outside the Commission Role ladder.
_Avoid_: safety team, patient safety committee

### Forms and responses

**Form**:
A named checklist owned by a Commission. A Form is an identity, not content. Its content
lives in Form Versions.
_Avoid_: questionnaire, survey, template, checklist

**Form Version**:
One immutable-once-published revision of a Form's content. Editing a published Version
produces a new draft rather than changing it.
_Avoid_: revision, draft, edition, copy

**Section**:
An ordered division of a Form Version. May be conditional on an earlier answer, and may
require a Sign-off.
_Avoid_: page, group, block, fieldset

**Item**:
One entry in a Section. An **input item** collects an Answer and carries a Question Key;
a **display item** only renders and is invisible to dashboards.
_Avoid_: field, question, element, widget

**Question Key**:
The stable identifier that lets one input item be compared across Form Versions. It is
what makes a dashboard possible.
_Avoid_: field name, slug, column, id

**Response**:
One person's filling of one Form Version. Resumable while in progress; immutable and
counted once submitted.
_Avoid_: submission, entry, record, result

**Answer**:
The value a Response holds for a single input item.
_Avoid_: value, result, datum, reply

**Sign-off**:
A named attestation against one Section of one Response, recorded before submission.
_Avoid_: approval, signature, confirmation, ack

### Governance and accreditation

**Case**:
A tracked matter a Commission works through over time, as opposed to a one-off Response.
_Avoid_: ticket, issue, incident, record

**Referral** (_Encaminhamento_):
A Case sent from one Commission to another over a frozen snapshot, answered with a
structured reply. The full trajectory stays visible.
_Avoid_: handoff, transfer, escalation, forward

**Patient-safety Event**:
A notified occurrence that enters triage, may open a root-cause analysis, and closes
through a CAPA.
_Avoid_: incident, error, adverse event, report

**CAPA**:
The corrective and preventive action that closes a Patient-safety Event or a
non-conforming Internal Audit finding. A Case is not closed until its CAPA is.
_Avoid_: action plan, remediation, fix, follow-up

**Quality Indicator**:
A measure with a numerator, denominator, target, periodicity, and direction. Entered by
hand or derived from submitted Form aggregates via a Question Key.
_Avoid_: metric, KPI, measure, statistic

**Accreditation Standard**:
A requirement from a framework (ONA, JCI, or custom) that Commissions link artifacts to
as Evidence, producing a readiness and gap report.
_Avoid_: criterion, control, requirement, rule

**Evidence**:
An artifact a Commission links to an Accreditation Standard to demonstrate compliance.
_Avoid_: proof, attachment, document, artifact

**Controlled Document**:
A policy, POP, or protocol under a lifecycle: e-signed, with effective and expiry dates
and a scheduled review cycle. Distinct from an Attachment, which carries no lifecycle.
_Avoid_: policy, file, document, SOP

**Internal Audit**:
A scored self-assessment, also run as a mock tracer. A non-conforming finding opens a
CAPA.
_Avoid_: inspection, review, assessment, survey

**Meeting**:
A Commission's convened session, whose record is its Minutes.
_Avoid_: session, gathering, assembly

**Minutes** (_Ata_):
The approved written record of a Meeting.
_Avoid_: notes, transcript, record, summary

**Audit Trail**:
The append-only, tamper-evident record of every mutation, of reads of another member's
data, and of every PHI read. It records that something happened and who did it, never
the payload.
_Avoid_: log, history, activity feed, trace

### Patient data

**PHI**:
Patient health information. Held minimum-necessary and confined to exactly three isolated
modules: patient safety, Referral, and Case. Every other part of the platform holds none
by design.
_Avoid_: patient data, personal data, sensitive data

**Professional Identity**:
A practitioner's own identifying details. A distinct class from PHI, with its own
protection, and not to be reasoned about as if it were patient data.
_Avoid_: user data, profile, credentials, personal info
