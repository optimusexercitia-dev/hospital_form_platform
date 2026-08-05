# 0095 — Process/case integrity audit: remediation scope, corrections, and deferred remodels

- **Status:** Accepted
- **Date:** 2026-08-04
- **Branch:** `db/process-case-integrity`
- **Supersedes / amends:** nothing. Complements ADR 0079 (door blindness) and 0094 (composite FKs).

## Context

An external-style audit of the `process_templates → cases → case_phases → case_narratives`
cluster produced 4 HIGH, 8 MEDIUM and 4 LOW findings plus 11 recommendations. This ADR
records what was implemented, what the implementation attempt **disproved**, and what is
deliberately deferred — because three of the eleven recommendations were wrong, and that is
the most reusable output of the exercise.

## Decision 1 — implemented as substrate changes (migrations `20260906000100`–`001100`)

Eight of eleven, all defect fixes, all keystoned in `supabase/tests/296_process_case_integrity.sql`:

1. **H1** `case_phases` INSERT guard — the audited hole (a `FOR ALL` policy + INSERT grant let a
   client POST a phase born `completed`, bypassing the transition matrix entirely).
2. **H1-b** `app.in_case_rpc` made composable — a pre-existing latent defect surfaced by H1.
3. **H2** audit mesh completed (phase INSERT, case DELETE, four untriggered child tables).
4. **H3** commission-coherence moved into the substrate (8 columns).
5. **H4** `create_case_from_template` hardened against a ruleset naming a deleted result.
6. **M2** case-side `blocks[]` integrity — the arms the template side already had.
7. **M4/M5/M6/M7** composite form-version FK, revoked `TRUNCATE`/`TRIGGER`/`REFERENCES`,
   FK indexes, RLS initplan consistency.
8. **M8/L1** ordering constraints and the narrative pairing CHECK.

## Decision 2 — three recommendations were WRONG and are NOT implemented

Recorded because each was refuted by the system rather than by review, and each would have
shipped a regression.

- **"Derive `case_phase_offered_results` as a view."** It is a deliberate FROZEN per-case
  guard: `app.compute_case_phase_result` discards any result absent from it. Deriving it
  would destroy the freeze and make the guard circular. The *naming* criticism stands (its PK
  is `(case_id, result_id)` — case-grained, despite the name) and is the whole of Decision 3c.
- **"Forbid hard-delete of a referenced `phase_results` row; archive instead."** Implemented,
  then rejected by `supabase/tests/210_phase_result_junctions.sql` — an existing keystone that
  deliberately deletes a ruleset-referenced result and asserts a clean cascade. Deletion with
  graceful degradation is the designed behaviour. The real defect was narrower: the
  *derivation* in `create_case_from_template` did not tolerate it (H4 above).
- **"`blocks[]` has no existence check and nothing revalidates on delete."** False for the
  template side, which already has both (`app.validate_template_phase_blocks` and
  `remove_template_phase`'s refuse-then-shift-then-revalidate). The defect is that the CASE
  side inherited neither — a missing sibling arm, not a bad model.

## Decision 3 — deferred, each needing its own phase and human approval

- **3a · Process-template versioning (audit M1).** Templates are mutable while `active` and
  unversioned; `cases.template_id` is `ON DELETE SET NULL`, so deleting a template erases the
  provenance of historical cases. For an accreditation product, "which process was in force
  when this case ran" is a survey question. The fix mirrors Rule 5 (publish freezes; edit
  clones) across 5 child tables, ~12 RPCs, types and UI. **Not started.**

  ⚠ **Correction (same day).** An earlier draft of this ADR deferred it because it "collides
  with the FF/Phase-16 sequencing". That is **false** and was taken from CLAUDE.md §5 — a line
  that carries its own warning to verify against PROGRESS.md. Per PROGRESS.md the
  Flexible-Forms program closed 5/5 on 2026-08-03 and Phase 16 completed 2026-08-04 (merged and
  pushed); **no gated phase remains in front of the pilot deploy.** There is no sequencing
  collision. The real reasons to defer, which are stronger:

  1. **The pilot deploy is the next step and is user-gated**, and its remaining half is the
     Coolify deploy plus a remote `db push` of every local-only migration. Template versioning
     would add a phase-sized schema change to that queue.
  2. **It re-points `cases.template_id`, which is populated on the remote.** That is a
     data-dependent migration — the class that passes a local reset against 0 rows and fails
     `db push` on a data-bearing remote.
  3. **Three open pre-pilot items outrank it**, two of them security: BUG-AUTHZ-002 and
     AUDIT-INVOKER-WRAPPER. Template versioning is a provenance/auditability improvement with
     no known exploit.
  4. It is phase-sized, so CLAUDE.md §6 requires human approval before it starts regardless.
- **3b · `blocks integer[]` → a join table.** With M2 shipped, this is a modeling-purity
  change, not a correctness one. Deferred as churn that a pre-pilot branch should not absorb.
- **3c · Rename `case_phase_offered_results` → `case_offered_results`.** Cosmetic but earned:
  the misnaming caused this very audit to propose destroying the table's freeze property.

## Consequences

- The pgTAP suite grew 4796 → 4819; `db reset`, `npm run test:db`, `npm run test`, lint and
  typecheck are green; `ARM=floor` holds; the diff-scoped door sweep returns **0 BLIND**.
- One pre-existing harness `ERROR` remains on `cases.cases_staff_admin_write`
  (`run-shape!=baseline`). Reproduced with the new test file removed, so it is not a
  regression; it is unauditable by the sweep and needs its own keystone (FUP).
- Two sibling helpers still force `app.in_case_rpc` to `'off'` rather than restoring it
  (`app.compute_case_phase_result`, `public.sync_case_phase_on_submit`). Pre-existing, not on
  the path H1-b had to unblock, and left for a change that can prove its own fix (FUP).
- The audit's own §2 praise of the snapshot discipline is reaffirmed: the corrections in
  Decision 2 are all cases where that discipline was *more* deliberate than the audit assumed.
