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

---

## Follow-on refinement — case-access dialog + narrative-card attribution (2026-06-19, frontend-only)

> Appended from PROGRESS.md 2026-06-25 (§7 cleanup).

### Refinement: Case-access dialog + narrative-card attribution (frontend-only) — ✅ FE DONE 2026-06-19

UI relocation of two existing affordances (no BE/RLS/type/migration change; ADR 0033 D6 preserved):
1. Inline `CaseAccessPanel` → a **"Acesso ao caso"** top-bar button + Dialog (grants-only roster),
   mounted independently in the coordinator `(detail)` layout so it still shows on TERMINAL cases
   (read-grant reachable). Members + `caseAccessEnabled()` lifted out of the `if (isOpen)` block.
2. The panel's "Responsáveis pelas narrativas" `<select>` section is **removed**; narrative
   attribution moves onto each `CaseNarrativeCard` as a coordinator `DropdownMenu` (assign / change /
   remover responsável), threaded via `CasePhaseList` (lifecycle branch only; flag-OFF unaffected).
3. Follow-up tweak: the grant dialog roster now lists **only non-coordinators** (`m.role !==
   "staff_admin"`) — a `staff_admin` already has full-case access by role, so granting/revoking on
   them (incl. the viewer on themselves) is meaningless. Empty-state line when no grantable members.
   Scoped to `case-access-panel.tsx`; narrative-assignee list (coordinators stay selectable) untouched.

| # | Frontend task | Status |
| - | ------------- | ------ |
| R-1 | `case-access-button.tsx` (button + Dialog wrapping grants roster) | ✅ done |
| R-2 | `case-access-panel.tsx` → grants-only (strip narrative section) | ✅ done |
| R-3 | `(detail)/layout.tsx` — load members + flag unconditionally; mount button | ✅ done |
| R-4 | `case-detail-view.tsx` — remove inline panel block + import | ✅ done |
| R-5 | `case-phase-list.tsx` + `case-narrative-card.tsx` — card attribution dropdown | ✅ done |

> **`frontend` done (2026-06-19).** Lint 0 errors / typecheck exit 0 / `npm run build` Compiled
> successfully. Verified on the prod standalone build (logged in `chefe.ccih@test.local`): top-bar
> order is **Acesso ao caso · Adicionar fase · Concluir · Cancelar**; the dialog opens with the
> member roster (grant/revoke runs with no console errors); each narrative card shows the
> "Atribuir responsável"/assignee dropdown (assign + reassign verified, current assignee
> check-marked, "Remover responsável" present); the old inline panel + "Responsáveis pelas
> narrativas" `<select>` section are GONE from the body. **Terminal case (Caso 0012, Concluído):**
> the access button shows ALONE and "Conceder edição" is disabled while "Conceder leitura" stays
> enabled (D6). No `src/lib/**`/migration/spec changes.
>
> **Specs impacted (for `tester` — `e2e/case-access.spec.ts`):** two locator families changed.
> (1) The coordinator access roster is no longer inline on the case body — it's behind a top-bar
> **"Acesso ao caso"** button that opens a `[role="dialog"]`; any step that asserted/interacted
> with the inline panel must first click that button, then scope to the dialog. (2) Narrative
> assignment is no longer a `<select id="narrative-assignee-*">` — it's a `DropdownMenu` on each
> narrative card (trigger `aria-label="Responsável pela narrativa <heading>"`; items are
> `[role="menuitem"]` with member names + a destructive "Remover responsável"). Update those
> locators; the underlying actions (`grantCaseAccess`/`revokeCaseAccess`/`assignNarrative`/
> `unassignNarrative`) are unchanged.
>
> **Specs impacted — ADDENDUM (follow-up tweak, 2026-06-19; `tester` already reported GREEN below —
> please re-check this one assertion):** the grant **dialog roster now excludes coordinators**
> (`staff_admin`). The viewing coordinator `chefe.ccih` is NO LONGER a row in the dialog, so any
> assertion expecting `chefe.ccih`/a "Coordenação" row inside `getByRole('dialog', { name: 'Acesso
> ao caso' })` must change. Grant/revoke steps should target a regular `staff*.ccih` member.
> Verified in-preview on Caso 0001: roster dropped from 8→7 rows, `chefe.ccih` absent, all rows
> labelled "Membro", grant on a regular member still succeeds with no console error. Note
> "Coordenadora Multi" REMAINS (she is `staff` in CCIH, `staff_admin` only in commission B — the
> filter is on the CCIH membership role, which is correct). Empty-roster case renders "Nenhum outro
> membro para conceder acesso." Narrative-assignee dropdown is unchanged (coordinators stay selectable
> there — out of scope).

> **`tester` GREEN (2026-06-19).** `e2e/case-access.spec.ts` updated to the new UI — the roster is
> driven through the "Acesso ao caso" dialog (`getByRole('dialog', { name: 'Acesso ao caso' })`),
> narrative assignment through the card `DropdownMenu` (`aria-label="Responsável pela narrativa …"`).
> New assertions: **AC-3d** (TERMINAL case — access button shows alone, "Conceder edição" disabled /
> "Conceder leitura" enabled, ADR 0033 D6), **AC-N1** (card assign → assignee shown → "Remover
> responsável" clears), **AC-N2** (negatives: no inline panel heading, no `narrative-assignee-*`
> `<select>`). Result **15 passed / 2 skipped** (AC-9 flag-ON skip; AC-7 conditional — no safety
> event linked to Caso 0001 in the current DB). Broader cases triage (chromium): **0 new
> regressions** — `cases-extras` 4 fails + `case-narratives` AC-1 all matched to the pre-existing
> shared-DB / spec-isolation baseline (an assignment/dialog change cannot alter narrative-TYPE
> labels or the docs/tags/action-item panels).
>
> **QA — right-sized SKIP (lead, 2026-06-19).** No formal `qa` gate for this refinement: it changes
> ZERO security surface — no RLS / predicate / `SECURITY DEFINER`, no server action, no type, no
> migration, no new route group (the "Acesso ao caso" button sits INSIDE the already-coordinator-
> gated `(detail)` layout; the card attribution control is `canManageLifecycle`-gated; both server
> actions re-check authz server-side). The security posture is the one QA already APPROVED for the
> increment. Lead reviewed every diff (file ownership, flag-OFF invariant via the legacy
> `case-phase-list` branch, the D6 terminal-case rule) + tester GREEN stand in for the gate. A formal
> QA pass is available on request.
>
> **Coordinator-exclusion re-verify GREEN (tester, 2026-06-19).** The follow-up tweak's spec re-check
> passed: lock assertions added to AC-3c/AC-3d (`Chefe CCIH` row ABSENT from the dialog;
> `Coordenadora Multi` present as the counter-case) — `e2e/case-access.spec.ts` still **15 passed /
> 2 skipped**, 0 regressions. All three changes verified green. **Record: pending human approval.**
> Files to stage: `case-access-button.tsx` (new), `case-access-panel.tsx`, `case-detail-view.tsx`,
> `case-narrative-card.tsx`, `case-phase-list.tsx`, `(detail)/layout.tsx`, `e2e/case-access.spec.ts`,
> `PROGRESS.md`.

