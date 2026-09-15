---
id: BUG-AE5-STAFF-INTERVIEW-CHILDREN-BYPASS-CLEARANCE-VIA-WRITE-POLICIES
status: open
severity: catastrophic
area: cases
opened: 2026-09-15
closed: null
feature: AE5-STAFF
related_adrs: [0079]
---

# BUG-AE5-STAFF-INTERVIEW-CHILDREN-BYPASS-CLEARANCE-VIA-WRITE-POLICIES

## Symptom

A coordinator without confidentiality clearance cannot read a `legal_privileged` interview but can read its subjects (names, clinical role, notes), interviewers, links and sessions.

## Expected behavior

Every interview child row is readable only where the parent interview is readable, including the clearance ceiling.

## Actual behavior

The child tables' FOR ALL `*_write` policies grant SELECT through USING = `app.can_write_interview(interview_id, uid) AND NOT app.is_case_excluded(…)`; `can_write_interview` has no clearance term, and permissive policies OR together, so the write policy walks around the read policy's clearance conjunct.

## Reproduction

Rolled back: `q2/review/clearance_probe.sql` (lead scratchpad). As postgres set `case_interviews f2000000-…-e1` to `legal_privileged`; `app.can_read_interview(…, chefe.ccih) = f`, `app.can_write_interview(…) = t`. As chefe.ccih (`staff_admin`, 0 case grants): `case_interviews` 0 rows; `case_interview_subjects` 2; `case_interview_interviewers` 2; `case_interview_links` 1; `interview_sessions` 2. After rollback the label reads `non_phi_internal`.

## Impact

PHI exposure inside the tenant past a confidentiality ceiling (legally privileged interviews), to principals the read door refuses.

## Investigation

Found by the AE5-STAFF F1 adversarial plan review (`q2/plan-review.md` P1-3 / PRE-3), measured by the review lead and reproduced by the unit lead. On `main` since the baseline; last redefined `20261003004710`. Hosted database not measured.

## Root cause

_TBD_

## Fix

_TBD_

## Regression protection

_TBD_

## Related code

Policies `case_interview_subjects_write`, `case_interview_interviewers_write`, `case_interview_links_write`, `interview_sessions_write`; `app.can_write_interview`; `app.can_read_interview`.

## Lesson

_TBD_

## Resolution

_TBD_
