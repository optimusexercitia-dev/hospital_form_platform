# 0084 — Bulk Case Creation ("Múltiplos casos")

**Date:** 2026-07-23 · **Status:** accepted. **Owner:** lead → backend/frontend/tester.
**Flag:** `cases_bulk_create` (new, default off; seeded on for local/E2E). **PHI:** reuses
the existing audited case-patient single door per row — **no new PHI store**, and PHI never
persists until the atomic commit, so Rule 12's "exactly three PHI modules" invariant is
untouched. **Relates to:** ADR [0038](0038-case-patient-identifiers.md) /
[0064](0064-case-subject-generalization-participants.md) (the patient single door this
composes), [0083](0083-case-custom-fields.md) (the per-case custom-field snapshot it carries),
ADR 0017 (published-version pinning, inherited via `create_case_from_template`), ADR 0033
(case assignment → case-read grant), ADR 0078 (catalog-is-truth authorization discipline used
to verify the composition). **Build status: ✅ SHIPPED — merged to `main` 2026-07-23**, flag
`cases_bulk_create` **ON permanently** (`255a8e9`); migrations `20260823000000` +
`20260824000000`. pgTAP 29/29 · `next build` + vitest 390 green · E2E 8/8 prod-standalone ·
QA APPROVED (4 non-blocking MINORs, fixed `b948c9f`). Ledger →
[docs/progress/bulk-case-creation.md](../progress/bulk-case-creation.md).
*(This field read "paused pre-merge for tester E2E + QA" until 2026-07-28, five days after it
merged; corrected from git during the docs reconciliation.)*

## Context

Committees routinely open **many Cases at once** — e.g. a fixed percentage of admitted
patients drawn as an audit sample, each analyzed as a Case and distributed across committee
members. Doing this one Case at a time through the "Novo caso" dialog — then hand-activating
and assigning each first phase — is slow and transcription-error-prone for a 30–50 patient
batch. This feature adds a semi-automatic bulk flow: one Process → per-case data pre-filled in
a grid → an automatic, fair deal across chosen members → created in a single atomic operation.

The design was grilled (2026-07-23) to resolve the forks the one-line brief left open: the
distribution semantics, what "attribute a phase" means in this schema, the deadline model,
the entry UX, the commit/PHI model, and access. The composition contract was verified against
the **live catalog** (`pg_get_functiondef` / `pg_trigger`), not migration text (ADR 0078).

## Decisions

1. **One atomic RPC that COMPOSES the existing doors — never re-implements them.**
   `bulk_create_cases(p_template_id, p_deadline, p_phase_scope, p_rows jsonb)` (SECURITY
   DEFINER, one transaction, all-or-nothing) loops per row over `create_case_from_template`
   (snapshot phases + version-pin + custom-fields + narratives + HC068 required-check),
   `activate_phase` (the first phase), `assign_narrative`, and `set_case_patient`.
   Re-implementing any of these would drift from the single source of truth. A per-row failure
   re-raises with a `linha N:` prefix (SQLSTATE preserved) and rolls back the **whole** batch.
   Hard cap **≤ 200 rows/batch**.
2. **The balanced deal is computed CLIENT-side; the server validates + executes, never
   randomizes.** The wizard shuffles cases + selected members and deals them (max workload gap
   ≤ 1), shows a preview the coordinator can re-shuffle or hand-adjust, then submits an
   **explicit `case → owner` map**. The server validates authority + that every assignee is a
   commission member, then writes exactly the submitted map — so the committed deal is provably
   what was previewed, and no RNG lives in SQL. **One member owns a whole case** (phases are
   never scattered across people).
3. **"Attributing the first phase" = ACTIVATING it.** In this schema a phase gets an assignee
   only via `activate_phase` (status→active + assignee + due_date; the case→`in_review`
   transition is the `recompute_case_status` trigger, not the fn). So each case's
   lowest-`position` phase goes live on create. The scope toggle:
   - `first_only` — activate/assign just the first phase; downstream phases + narratives stay
     unassigned.
   - `all_phases` — additionally **pre-assign** every downstream phase to the same owner while
     leaving it `pending`, and assign every narrative. Pre-assigning a `pending` phase is a
     **newly sanctioned state**, written via a guarded `assigned_to`-only UPDATE under the
     `app.in_case_rpc` GUC (which `guard_case_phase_status` permits). The audited read paths
     (`list_my_cases`, `can_read_case`) already separate assignment from actionability, so the
     state is benign.
4. **Deadline = the first phase only, absolute date, optional.** It rides `activate_phase`'s
   `due_date`. Narratives carry no deadline; downstream phases acquire theirs when reached.
5. **staff_admin-only — deliberately stricter than `create_case_from_template`'s own gate**
   (which also admits a `create_cases` Administrativo). Bulk dealing + PHI writes are
   coordinator acts; the RPC raises `42501` for anyone not staff_admin / commission-admin of
   the template's commission. The route mirrors this gate for UX, but the RPC is the authority
   (Rule 1).
6. **No server draft; PHI rides the existing single door.** The grid lives client-side and is
   validated in place; a single atomic RPC then creates everything. PHI is written per row
   through `set_case_patient` (patient_enabled + name-or-MRN floor + coordinator-only + audit,
   all server-enforced) and **never persists until the cases exist** — no fourth PHI-at-rest
   location is introduced (Rule 12).
7. **Entry UX = a dedicated full-page wizard + spreadsheet grid + paste.** Four steps
   (Processo/campos/prazo/escopo → Membros → Grade → Distribuição). The grid supports
   paste-from-spreadsheet, per-column fill-down, and in-grid validation. The case title is the
   non-identifying `label`, auto-generated `«prefixo» #N` (editable per row) and **never**
   derived from patient identifiers.
8. **Selectable columns — custom fields AND PHI (Enhancement E1).** Step 1 lets the coordinator
   pick which of the Process's custom fields (required ones forced in) and which PHI identifiers
   become grid columns. PHI defaults to Nome + Prontuário; if any PHI field is selected, the
   name-or-MRN floor is enforced as a Step-1 advance gate. This keeps the grid narrow and makes
   the **minimum-necessary** principle explicit in the UI (Rule 12). The per-row serialization
   already sent a partial patient, so E1 is frontend-only — no backend/RPC/pgTAP change.
9. **Concurrency:** a per-commission `pg_advisory_xact_lock` at batch start closes the
   pre-first-insert window over `mint_case_number` (itself already a per-commission advisory
   lock in a BEFORE-INSERT trigger).
10. **Feature-flagged** `cases_bulk_create` (default off; typed in `FeatureFlags`; seeded on for
    local/E2E).

## The concrete surface

- **Backend:** `supabase/migrations/20260823000000_bulk_create_cases.sql` (flag +
  `app.assert_bulk_create_enabled` + `public.bulk_create_cases`); action `bulkCreateCases` +
  contract types in `src/lib/cases/bulk-actions.ts`; regenerated `src/lib/types/database.ts`;
  pgTAP `supabase/tests/189_bulk_create_cases.sql` (29 assertions). Composes
  `create_case_from_template` (6-arg), `activate_phase`, `assign_narrative`, `set_case_patient`
  → `set_participant_patient`.
- **Frontend:** route `src/app/o/[org]/c/[commission]/manage/cases/multiplos/{page,loading}.tsx`;
  the "Múltiplos casos" board button (`…/manage/cases/page.tsx`); `bulk-create-wizard.tsx` +
  `bulk-step-{process,members,deal}.tsx` + `case-bulk-grid.tsx`; pure, unit-tested cores
  `src/lib/cases/distribute.ts` (balanced deal) + `src/lib/cases/bulk-grid-model.ts` (columns /
  paste / validation).

## Consequences

- **Positive:** correctness by composition (no logic drift); true all-or-nothing;
  PHI stays inside the three sanctioned modules with no new at-rest surface; the
  client-computed / server-validated deal keeps RNG + instant re-shuffle off the server while
  making the committed deal auditable; minimum-necessary PHI columns; the balanced deal is fair
  by construction (gap ≤ 1).
- **Negative / accepted:**
  - A ~200-case transaction (snapshot + recompute + activation + per-row PHI) is the price of
    atomicity; the 200 cap bounds it — no cross-transaction chunking.
  - `pending` + `assigned_to` is a state the app did not previously produce (D3); audited clear
    for current read paths, but future worklist code must not assume `assigned_to ⇒ active`.
  - staff_admin-only excludes `create_cases` Administrativos from bulk creation (by design).

## Deferred (out of scope)

- **Per-case department** (v2; PO-deferred 2026-07-23) — bulk cases mint with no department,
  settable later per-case.
- Assignee notification on activation/assignment (no such mechanism is wired today).
- Cross-existing-case duplicate detection (within-batch duplicate is a soft warning only).
- Batch-level undo (cases are cancelled individually post-hoc).
- Load-aware distribution (weighting by each member's existing open caseload).
