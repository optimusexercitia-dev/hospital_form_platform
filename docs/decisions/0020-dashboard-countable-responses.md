# ADR 0020 — Dashboard-countable responses: case-phase exclusion

**Date:** 2026-06-13
**Status:** Accepted
**Phase:** 8 (Dashboards & Submissions Browser)

## Context

A Phase-7 case phase is a `responses` row carrying a non-null `case_phase_id`,
pinned to a form's published version. So a submitted case-phase response shares a
form's `form_version_id` with that form's standalone fills (e.g. the seeded
case-phase-1 response of `staff1.ccih` on Form A's version `…-a001`). A naive
"submitted-only" aggregation would count it on the form's standalone dashboard,
inflating the form's own statistics whenever a case runs.

The dashboard aggregations must also pick the "countable" set consistently in one
place (Architecture Rule 9 centralizes the "dashboard-countable responses"
filter), and the submissions browser must let a coordinator inspect every real
submitted response.

## Decision

- **Standalone form dashboards EXCLUDE case-phase responses**
  (`responses.case_phase_id IS NULL`), in addition to `status = 'submitted'`. A
  form's own statistics never drift when a case workflow uses that form. Form A's
  dashboard therefore reports **6** submitted, not 7. Case analytics live on the
  cases board, not on the form dashboard.
- **The submissions browser INCLUDES case-phase responses, badged**
  (`SubmissionRow.isCasePhase` / `SubmissionDetail.isCasePhase`). They are genuine
  submitted responses a coordinator may legitimately inspect; the UI can
  segregate them. This path does NOT use the countable-filter helper.
- **Single source of the filter.** The SQL function
  `app.submitted_form_responses(form_id)` (migration `20260613090011`) is the one
  authority for `submitted AND case_phase_id IS NULL` and backs every aggregation
  RPC. Its TS twin is `isDashboardCountable()` in `src/lib/queries/dashboard.ts`
  for any TS-side count. Keep the two in agreement.

## Consequences

- Tester's exact acceptance numbers depend on this: Form A standalone dashboard =
  6; the case-phase response is asserted EXCLUDED from totals/over-time/
  completion/distributions (pgTAP `100_dashboard.sql` test 9). The admin
  cross-commission overview's `submitted_count` is likewise standalone-only.
- The chosen split (over the lead's initial "count it everywhere") keeps a form's
  audit numbers stable and intuitive while losing no inspectability — the case
  response is still fully visible and openable in the submissions browser.
- Extension point: if a future "case-inclusive" form analytics view is wanted, it
  would be a separate read that deliberately drops the `case_phase_id IS NULL`
  conjunct — never by relaxing `app.submitted_form_responses`.
