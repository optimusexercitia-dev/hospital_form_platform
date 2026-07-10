# F1 — Case-Participants E0 (Pre-Pilot Foundations Program) — COMPLETE

**Completed 2026-07-10** on branch `feat/pre-pilot-foundations-plan`.
ADR [0064](../decisions/0064-case-subject-generalization-participants.md) (E0 slice) +
ADR [0066](../decisions/0066-patient-xref-participant-rekey.md) (patient_xref re-key),
conforming to the F0 conventions ([ADR 0065](../decisions/0065-pre-pilot-foundations-conventions.md)).
Contract-first build phase (migration + data-access + pgTAP). Flags
`case_participants`/`case_types` seeded **OFF** (m2 hard gate — no flip on real ethics
data until post-pilot E1). E1 access-spine + E2 ethics procedure **not built**.
F1 **precedes F2** (attachment_subjects → participants).

## Tasks (all ✅)

| # | Task | Owner | Notes |
| - | ---- | ----- | ----- |
| F1-1 | **Migration contract** (plan-in-text) — reviewed & **APPROVED** by lead 2026-07-10 w/ Q1–Q6 rulings (xref→participant_id [new ADR] · keep `case_patient.read` · disposal redaction + **patient `display_name` non-PHI-by-construction** invariant · reuse 42501, alloc HC094/HC095 only · case-scoped professional read) | backend | contract-first |
| F1-2 | `participants` (org-anchored · `participant_type` · `sensitivity_class` CHECK-derived · `UNIQUE(id, participant_type)`) + `case_participant_roles` + `case_participants` (primary-subject partial-unique) | backend | dialect 3 (typed-identity registry) |
| F1-3 | `professional_profiles` + `professional_participants` (**Class 2** — case-scoped RLS, `professional_profile.read` on `log_audit_access` allow-list, no isolated door) | backend | Rule 12 Class 2 |
| F1-4 | `patient_participants` + **re-key `case_patient → patient_identifiers(participant_id)`** (N/case, all DML REVOKED, atomic DEFINER writer, `get_case_patient → get_participant_patient`); generalize `dispose_case_phi` to per-participant satellites + `patient_xref` purge (R3, xref entity→participant_id) | backend | zero-prod-PHI re-key while flag OFF |
| F1-5 | `case_types` + `case_type_terminology`; **denormalize `organization_id` onto `cases`** (R2, guard HC095) | backend | flags OFF |
| F1-6 | Data-access (`src/lib/queries/`) + generated types regen (Rule 8); new xref-rekey ADR 0066 | backend | no inline supabase-js |
| F1-7 | pgTAP keystones (subtype↔type guard · patient door NULL-out-of-scope w/ N patients · professional audited read · primary-subject unique · cross-tenant isolation HC094 · disposal-purges-xref · patient registry row exposes no raw PHI · inherited R1 gate) | backend | ADR 0064 §Consequences |

## Gate (§6)

- **Build ✅** — pgTAP **1913/1913** (fresh reset) · tsc/eslint **0** · Vitest **294** · generated types regenerated.
- **Tester E2E ✅ — 0 F1 regressions.** F1 surface **54/54** post-fix (participant chain
  case-patient / patient-index / processless + phase7-cases; fresh reset, 3.3 min). The full-suite
  marathon (583p / 24f / 55-dnr) failures were **dev-server infra flakiness** — non-deterministic
  (24→7 on isolated re-run), all login `waitForURL` / 150s cold-compile / `uncaughtException: aborted`,
  **zero F1-domain specs**, empty error-contexts. Classified env-only per project precedent
  (running the full suite against `npm run dev` under `--workers=1` for ~1h degrades the dev server).
- **QA ✅ APPROVED** ([review](../reviews/phase-F1-review.md); CHANGES→APPROVED same day). QA found
  **MAJOR-1** — a genuine latent defect: 7 new non-PHI tables (`participants`, `case_participants`,
  `case_participant_roles`, `professional_profiles`, `professional_participants`, `case_types`,
  `case_type_terminology`) shipped RLS `SELECT` policies `to authenticated` with **no table GRANT**,
  making the boundary inert (`permission denied` before RLS evaluated). Fixed by backend:
  `grant select` on all 7 (+ catalog `insert/update/delete` grants where the `_admin_write` policy is
  org-admin-gated; **dropped** the read-gated `case_participants_write` `FOR ALL` policy — writes stay
  DEFINER-RPC-only until E1). Compat-door invariant comment (MINOR-2) + stale doc comment (INFO-1)
  aligned. Regression-locked by pgTAP **K9** (9 assertions exercising the grant+policy pair *as*
  `authenticated`, so reverting a grant re-breaks the suite). PHI tables `patient_identifiers` /
  `patient_participants` left door-only (DML REVOKED, 0 policies) — verified untouched.
- **Human ✓** — approved 2026-07-10.

## Commits (branch `feat/pre-pilot-foundations-plan`, local — not pushed to remote; pre-pilot reset-OK)

- `ef66b0a` — `feat(F1): Case-Participants E0 — typed-identity registry + patient re-key (ADR 0064/0066)`
- `6805bd9` — `fix(F1): close QA MAJOR-1 — grant SELECT on 7 non-PHI tables (inert RLS boundary)`
- graphify refreshes `764a792`, `8800a36`.

## Deferred (post-pilot)

- **E1** — case-participants access spine (direct reads now unblocked by the F1 grants).
- **E2** — ethics-procedure case type (only then may the `case_participants` / `case_types` flags flip ON).
