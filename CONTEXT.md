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

**Member** (deprecated):
Ambiguous — do not use standalone. Say the `memberships` row (it GRANTS a role), the
`hospital_affiliations` / `organization_affiliations` row (it only LOCATES someone; an
affiliation never grants — Architecture Rule 13), or "committee/commission member" in
prose. `commission_members` is not a table; it does not exist.
_Avoid_: member (bare), commission member (as a data noun), commission_members

**Affiliation**:
The link between a person and the Hospital they work at. Distinct from Membership: it
describes where someone is, not what they may do.
_Avoid_: attachment, posting, assignment

**Restricted personal details**:
The person fields withheld from ordinary reads even where the person themselves is
visible: CPF, date of birth, personal phone. Narrower than "personal data" — a person's
name and e-mail are personal data yet ordinarily readable.
_Avoid_: the PII columns, sensitive columns

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

### Authorization

**Assignment**:
The fact that a person holds a Role at one exact place — an Organization, a Hospital, or a
Commission — for as long as that seat is live. It says who someone is there, not what they
may do.
_Avoid_: grant, seat, hat

**Permission**:
A stable, action-oriented name for one thing the platform lets someone do, such as editing a
Commission's Forms or reading a professional's profile. Roles bundle Permissions; enforcement
points name them.
_Avoid_: capability (reserved for Administrativo), feature, scope

**Entitlement**:
A Permission that a person's Assignments confer, including whatever that Permission implies.
A positive source only — holding an Entitlement is never by itself leave to act.
_Avoid_: access, right, privilege

**Domain authorizer**:
The single question an enforcement point asks before letting an action through. It applies
the hard denials first — recusal, a respondent's exclusion, record lifecycle, sensitivity
ceilings, tenancy — and only then asks whether an Entitlement exists.
_Avoid_: resolver, permission check, guard

**Enforcement manifest**:
The generated record of which Domain authorizer enforces each Permission, and where. A
Permission with no named enforcement point is a defect, never a default.
_Avoid_: mapping, allowlist

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

### Authorization and the door audit

**Door**:
A callable authorization surface a caller can reach — an RLS policy, a `SECURITY
DEFINER` function, or an `INVOKER` wrapper sitting in front of one. (ADR 0079;
`docs/progress/authz-handoff.md` §7.14)
_Avoid_: endpoint, route, check

**Gate**:
The boolean predicate inside a Door that decides whether it lets a caller through. A
`SECURITY DEFINER` function's own gate REPLACES RLS entirely for that door. (ADR 0078
§A35; CLAUDE.md §3 Rule 12)
_Avoid_: guard, filter, condition

**Arm**:
One mutation-test lane of `supabase/tests/mutation/p0-authz-invariant.sh`: `census`
(every gate carries a verdict), `hat` (no caller-bound gate is missing its active-role
condition), `floor` (every reachable door was called at least once), `wrapper` (the
`prosecdef = f` INVOKER surface is swept), `policy` (every neutralized gate is BLIND or
allowlisted). (ADR 0079 Amendments 3, 4, 6, 7)
_Avoid_: sweep (one run of an arm), check, test

**Keystone**:
A pgTAP assertion written to prove one specific Gate is enforced — proven real, not
vacuous, by reverting the gate and requiring the assertion to fail. (`docs/progress/authz-handoff.md`
§7.1; ADR 0079)
_Avoid_: test case, assertion, check

**BLIND**:
The verdict for a Gate that a neutralization Sweep opened and no Keystone noticed — an
authz gate no test exercises, passing green over a live leak. (`supabase/tests/mutation/p0-authz-invariant.sh`;
ADR 0079 Decision 1)
_Avoid_: uncovered, untested, missing

**Census**:
The catalog-wide inventory (`ARM=census`) asserting every `prosecdef` boolean function
and every RLS policy carries a Verdict — BLIND, COVERED, ERROR, or SKIPPED — somewhere; a
gate in none of those has never been swept in any direction. (ADR 0079 Amendment 3)
_Avoid_: audit, inventory, count

**Hat**:
The caller's currently active Role for a session. A "hat-blind" gate reads `memberships`
or a JWT claim without conditioning on which hat is active, so a person can act using a
role they merely hold, not the one they are wearing. (ADR 0106 S4; `docs/progress/authz-handoff.md`
§7.17)
_Avoid_: active role (fine in prose), session role

**Floor**:
`ARM=floor`: the assertion that every `authenticated`-reachable `prosecdef = t` Door was
called at least once during a full pgTAP run — a lower bound on exercised doors, not a
claim about correctness. (ADR 0079 Decision 1)
_Avoid_: coverage, minimum

**Footprint**:
The set of Hospitals a person's active Affiliations currently span. An administrative
bound is derived FROM a footprint (INTERSECTION for person-level edits, SUBSET for
lifecycle/CPF changes) — a footprint is never itself a Role. (ADR 0133 AFF2 Amendment 1;
CLAUDE.md §1)
_Avoid_: scope, reach, territory

**Neutralizer**:
A sweep script that flips one Gate's boolean predicate open — or, for a row-returning
Door, walks it directly — then re-runs the suite to see whether any Keystone goes red. A
boolean predicate can be neutralized; a row-returning door must be walked. (ADR 0079
Decision 1, Amendment 4)
_Avoid_: mutator, fuzzer

**Noun rule**:
`platform_admin`'s boundary is drawn on what a table is ABOUT — tenancy, identity,
vocabulary, audit vs. commission content or PHI — never on a structural test such as "has
a `commission_id` column", which both over- and under-strikes the real population. (ADR
0078 §A35)
_Avoid_: column rule, table rule

**INVOKER wrapper vs. DEFINER body**:
A `public` `SECURITY INVOKER` function (runs as the caller; RLS applies) that sits in
front of an `app`-schema `SECURITY DEFINER` body (runs as the function owner; RLS never
applies to it). A wrapper with no gate of its own IS the door, and the DEFINER body
behind it is unprotected by RLS regardless of what the wrapper checks. (ADR 0079
Amendment 7; CLAUDE.md § graphify)
_Avoid_: proxy function, helper

**Sweep**:
One execution of a Neutralizer script (e.g. `p0-authz-door-audit.sh`) across every gate
in its domain, producing a Verdict per gate. (ADR 0079 Decision 1)
_Avoid_: audit (reserved for the standing invariant as a whole), scan

**Verdict**:
The classification a Sweep or Census assigns to one Gate: `BLIND`, `COVERED`, `ERROR`
(the harness never measured it — NOT a pass), or `SKIPPED`. (`supabase/tests/mutation/p0-authz-invariant.sh`;
`docs/progress/authz-handoff.md` §7.1)
_Avoid_: result, outcome, status

**Backstop / allowlist**:
A backstop is a Gate that is structurally unreachable by design. An allowlist may name
only a genuine backstop, never a live tenant-isolation policy — allowlisting a reachable
door is exactly what makes it BLIND. (CLAUDE.md §6; ADR 0079 Decision 1)
_Avoid_: exception list, ignore list, waiver
