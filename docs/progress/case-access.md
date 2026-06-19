# Increment Archive — Case Access Control & "Meus Casos"

**Status:** ✅ COMPLETE · **Completed:** 2026-06-19 (human-approved) · **Flag:** `case_access` (ON)
· **ADR:** [0033](../decisions/0033-case-access-control.md) · **Plan:**
[case-access-control.md](../phases/case-access-control.md) · **QA:**
[review](../reviews/case-access-control-review.md) (APPROVED)

A feature-flagged increment over Cases (Phases 7/12 + Case Narratives) making case access
adjustable and attribution-driven. Designed via a 14-question requirements interview (recorded in
ADR 0033 §Decision).

## What shipped

- **Per-case access model:** `case_access` ACL (read/write) + phase/narrative attribution, unioned
  through three uid-pure DEFINER predicates — `can_read_case` / `can_write_case_content` /
  `can_write_case_narrative` (Q14). Flag-OFF falls back to `is_member_of` (today's behavior).
- **Restrictive boundary (Q3):** base SELECT on `cases` + child tables tightened to `can_read_case`;
  a member with no attribution and no grant cannot see the case at all.
- **Narrative attribution (Q4/Q5/Q14):** `case_narratives` gains a single `assigned_to` + an
  `aberta→concluida` lifecycle (`concluded_at/by`); an attributed narrative is reserved to its
  assignee; a case-writer may author only un-attributed narratives.
- **"Meus Casos" (Q6/Q11):** replaces "Minhas fases" — one unified list of every case the member can
  touch (attributed or granted), per-case cards with inline item actions + "Ver caso completo".
- **One capability-gated detail page (Q7):** the shared `CaseDetailView` threads
  `CaseViewerCapabilities`, mounted at both `/manage/cases/[caseId]` (coordinator) and the new
  `/casos/[caseId]` (staff). Focused narrative editor at `/casos/[caseId]/narrativa/[narrativeId]`
  (Q12). Coordinator access panel (grant/revoke + narrative assignment).
- **Audit (Q10):** `case.opened` access-row on non-coordinator opens. **PHI-free (Q13):**
  `can_read_event`/`event_patient` untouched. The meetings ripple: a linked case a viewer can't read
  renders "Caso restrito" (`MeetingCaseLink.restricted`).

## Backend tasks (`backend`)

| # | Task | Outcome |
| - | ---- | ------- |
| BE-1 | Typed contract stubs (queries + actions + types) | ✅ `7763016` (unblocked FE in parallel) |
| BE-2 | Migration: `case_access` + `case_narratives` cols + flag (OFF) + `HC055` | ✅ `981e39f` (`…110000`) |
| BE-3 | Predicates + RLS tighten + flag-OFF fallback + read-ripple sweep | ✅ `981e39f` (`…110001`) — checkpoint pgTAP proven before BE-4 |
| BE-4 | Grant/narrative/`list_my_cases` RPCs + `get_case_detail` re-gate (submitted-only preserved) + content-write broadening | ✅ `e974f5c` (`…110002`) |
| BE-5 | `case.opened` audit + PHI-free `case_access`/narrative mutation triggers | ✅ `e974f5c` (`…110003`) |
| BE-6 | Flag ON (`…110004`) + regen types + wire stubs + seed personas + pgTAP | ✅ `e974f5c` — pgTAP 619/619 |

## Frontend tasks (`frontend`)

FE-1…FE-7 (`c4764b8` + `6c8adab`): nav swap + `/minhas-fases` redirect (flag-gated); `/meus-casos`
+ `MyCaseCard`; capability-gated `CaseDetailView` + staff `/casos/[caseId]`; focused narrative
editor; coordinator access panel; flag-gating + edge states; the `MeetingCaseLink.restricted` chip
(FE-7). All built against the frozen BE-1 contract; lint/typecheck/prod-build clean.

## Gate (§6)

- **Build:** backend pgTAP 619/619; frontend lint/typecheck/prod-build clean.
- **Test pass:** tester wrote `e2e/case-access.spec.ts` (13/13, AC-9 skipped — flag ships ON, pgTAP
  covers OFF). Full prod-build suite triaged to **0 regressions** against the `playwright-full-run-2`
  pre-increment baseline: 3–4 **behaviour-change** spec fixes (the new per-narrative "Concluir"
  button → unscoped `getByRole('Concluir')` strict-mode; scoped to `header`); 15 pre-existing harness
  flakes (dialog/animation timing + shared-DB cascade), all present in the baseline.
- **Fix-loop (2 iterations, both with durable regression guards):**
  - **CA-001** (BLOCKER, backend, `035967a`): `get_case_detail` declared `STABLE` but emits the
    `case.opened` audit INSERT → `25006` read-only-tx → non-coordinator opens 404. Fixed `STABLE→VOLATILE`;
    guard = pgTAP `provolatile='v'` + an audit-write behaviour assertion.
  - **CA-002** (MAJOR, frontend, `e913efe`): `canEditNarrative` checked `!canWriteContent` before the
    assignee check, locking a narrative assignee out of their own narrative. Reordered to mirror
    `app.can_write_case_narrative` exactly.
- **QA:** APPROVED — RLS spine verified (flag-OFF fallback proven at predicate + policy level;
  `WITH CHECK` correct; submitted-only verbatim; PHI untouched). Flagged items 3a/3b/3c all ACCEPTABLE.

## Seed personas (Caso 0001 "Óbito UTI leito 7", commission CCIH; password `Test1234!`)

`chefe.ccih` (coordinator) · `staff1.ccih` (phase assignee → full read) · `staff2.ccih` (narrative
assignee → full read, writes only the Resumo) · `multi` (read grant) · `staff3.ccih` (write grant /
collaborator) · `staff4.ccih` (boundary — no access). Verified live: `can_read_case` T/T/T/T/T/**F**,
`can_write_case_content` T/F/F/F/**T**/F.

## Follow-ups (carried to PROGRESS.md)

- `case_interviews` still member-read — case-scope to `can_read_case` to fully close the boundary
  (ADR 0033 D2; QA INFO-N1).
- `listCaseAccess(caseId)` read so the access panel shows live grant levels (QA INFO-N3).
- Push `…110000–110004` to remote when taking the feature live (needs human go-ahead).
- The prod-build E2E harness flakiness (~18–27 pre-existing) — `reducedMotion` + per-test DB
  isolation (QA INFO-N2; already tracked under Follow-ups).
- Legacy `update_case_narrative_body` returns `P0002` (not `42501`) for a non-reader — benign,
  unreachable on the new UI path (QA INFO-N4).
