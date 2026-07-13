# 0070 — Interview data-model v2: sessions + reporting / confidentiality columns

**Date:** 2026-07-12 · **Status:** accepted (design; not implemented). **Owner:** platform
lead → backend/frontend/tester.
**Scope:** Phase-11 **Interviews** revision; **reset-OK**, pre-pilot; behind the existing
`interviews` flag. Build plan → [docs/plans/interviews-v2-sessions.md](../plans/interviews-v2-sessions.md).
Source: partner handoff [interview_data_model_handoff.md](../design/temp/interview_data_model_handoff.md).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (canonical schema — extend, never
contradict), Rule 9 (data access via `src/lib/queries`), Rule 10 (pt-BR UI / English
code+keys), Rule 11 (append-only audit), Rule 12 (PHI isolation — interviews stay
**staff-only, non-PHI**).

## Context

Pilot-prep testing found the shipped Interview model too rigid: scheduling lives on single
columns of `case_interviews` (`scheduled_start/end`, `conducted_at`, `location_text`,
`meeting_url`, `modality`), so **one interview = exactly one encounter** — a reschedule or a
follow-up forces a *second interview row*, fragmenting subjects, summary, and links. A partner
team's from-scratch interview model (~25 tables: sessions, a people registry, participant
roles, attendance, consent, recordings, transcripts + segments, statements, findings,
per-audience summaries, an external-participant portal, per-interview access grants) was
evaluated feature-by-feature against ours. Most of it is **already satisfied** (Forms reuse via
`form_version_id`; the shared `attachments` table; hash-chained `audit_log`; case-level
RCA/CAPA as "findings"; the `participants` + `professional_profiles` registry **already built
in F1** but flag-OFF until E1) or **over-scoped** for a governance-layer pilot
(recording/transcripts/statements/external portal). The handoff's pervasive column-level
`*_encrypted bytea` pattern additionally **contradicts** our declined-column-encryption posture
(ADR [0035](0035-lgpd-anvisa-regulatory-posture.md)/[0037](0037-inter-committee-case-referrals.md)/0038 — platform at-rest encryption instead). The reset-OK
pre-pilot window makes the structural change **free** (no data migration); post-pilot it needs
one.

## Decision

Adopt three changes now, behind the `interviews` flag, **reset-OK hard-cut** (drop moved
columns; no back-compat):

1. **Sessions (structural).** New `interview_sessions` (1:N child of `case_interviews`); the
   five scheduling columns **move off** the interview onto the session, and `conducted_at`
   becomes per-session `actual_start`/`actual_end`. The **interview stays the lifecycle
   coordinator** — `draft → scheduled → in_progress ⇄ awaiting_follow_up → completed`, +
   terminal `cancelled` (**new state** `awaiting_follow_up`) — while sessions carry scheduling
   and their own status (`scheduled/in_progress/completed/cancelled/no_show`). The scheduling
   RPCs re-map to **session commands**; `conclude_interview` is unchanged at the interview
   level and still writes **exactly one** `case_events kind='interview'` registry row (body
   recomposed from session actuals). Attendance and schedule-history are **not** built
   (attendance → E1; reschedules ride an `audit_log` summary line).
2. **Reporting column (N1).** `case_interviews.interview_category` — the dashboard
   classification, **required-at-create**.
3. **Subject relationship (N2).** `case_interview_subjects.relationship_to_case` —
   **required-at-add**; the free-text `clinical_role` is kept alongside. Interviews stay
   **staff-only**: no `patient`/`family_member` values, **no new PHI surface**.

Plus one **non-enforcing** forward hook: `case_interviews.confidentiality_level`
(`standard/restricted/highly_restricted`, default `standard`) — a classification tag the UI
**explicitly labels as not-yet-gating**; access enforcement lands with E1. New enums use
**English keys** (Rule 10 / ADR [0069](0069-status-key-anglicization.md)); `modality` stays pt-BR (unchanged shared vocab).

**Deferred to E1 (post-pilot):** participant-registry wiring, interview-specific access grants
+ confidentiality *enforcement*, per-session attendance, participant-roles M2M,
`interview_topics`, versioned/per-audience summaries, a status-history table, document
semantic-role, org/hospital denorm. **Avoided entirely:** column-level encryption,
recording/consent/transcripts/segments, statements, interview-specific findings (duplicate
case RCA/CAPA), the external-access-link portal.

## Consequences

- The interview becomes a small **multi-encounter aggregate** without a table explosion; the
  conclusion/registry semantics that already work are untouched.
- Reset-OK hard-cut ⇒ no back-compat: the seed, pgTAP `121_interviews.sql`, and E2E
  `phase11-interviews.spec.ts` fixtures are rewritten; generated types regenerate; the
  `InterviewStatus` union gains `awaiting_follow_up`; the `InterviewDetail`/`InterviewListItem`
  contracts lose the scheduling fields (they move to a new `InterviewSession`) and gain
  `interviewCategory` + `confidentialityLevel`.
- Failure mode = a missed lifecycle prerequisite or an RLS gap on the new child; caught by
  pgTAP (transition NEG/POS + REVOKE guards) and the full E2E gate. This is a **Phase-11
  revision** and takes its **own Phase Gate**.
- `confidentiality_level` is inert until E1; its one risk (a "confidential" badge implying
  control it lacks) is mitigated by explicit UI copy — recorded here so E1 **wires
  enforcement** rather than re-introducing the column.
- Establishes the pattern for the next partner-model adoption: keep the investigative aggregate
  thin, reuse Forms/Documents/audit/RCA, and let the `participants` registry (E1) — not the
  Interview module — own shared identity.
