# RV2 R2–R5 — Referrals v2 Governance (COMPLETE)

**Status:** ✅ COMPLETE · gate-passed · PO-approved · **ff-merged to `main` (`a61aae3`, 2026-07-19)**.
Branch `feat/rv2-governance` deleted. **Local only** — origin push + Coolify deploy + pilot DB
reset DEFERRED to pilot (standing plan); `case_referrals` flag stays **OFF** until pilot enablement.

**Plan:** `docs/plans/referrals-v2-dialogue-governance.md` (§3 R2–R5 + the ADR-0078 reconciliation
banner). **ADRs:** 0037 (referrals), 0078 (authz capability model), 0079 (audit-door invariant).
Follows S2·RV2·R1 (dialogue core → `docs/progress/rv2-r1-referrals.md`).

**PO decisions (2026-07-18):** build FULL R2→R5 · R3 = full `answered`/`resolved` lifecycle · R5 trims
to notes+receipts+redaction (context-versions DEFERRED) · QPS excludes internal notes.

## Increments — each verified via git scope + LIVE catalog + `set local role` keystone, mutation-proven

| Increment | Commit | Ships | Keystone (live-proven) |
|---|---|---|---|
| R2 Triage/SLA | `8d2125b` | `case_referral +=` priority/requested_action_id/requested_action_label/response_due_at/decline_reason_code · `referral_requested_actions` vocab+seed · `app.referral_is_overdue` · `set_referral_deadline` (HC0A4) + vocab-CRUD (HC0A3) | PHI-free triage fields readable at metadata tier (via `can_read_referral_metadata`); `decline_note` PHI-gated (column REVOKE) |
| R3 Resolution cycles 🔴 | `dd5d090` | status `+= answered,resolved` · `referral_resolutions` (`summary_md` PHI-REVOKED, partial-unique one-active) · `parent_referral_id` lineage (D15 no-auto-share) · `resolve`/`reopen` RPCs · `conclude`→answered · `close_case` +answered block | authority-FIRST `42501` (before `HC0A5`); summary_md PHI-revoked; answered blocks / resolved releases / **draft non-blocking** |
| R4 Assignments/links | `b9cad33` | `referral_assignments` + `referral_case_links` · assign/update/cancel (HC0A7) · link/unlink (HC0A8) · `list_my_referral_assignments` | **assignment ≠ access + link ≠ access** — NEITHER table in ANY read predicate (0 residue, catalog-swept) |
| R5 Private notes | `c301a14` | `referral_internal_notes` (`body` PHI-REVOKED) + `referral_read_receipts` · create/list/redact RPCs (HC0A9) · dispose purge | **source≠target≠QPS** (`can_read_referral_internal_note`, NO PQS arm, cross-side structural); redaction append-only `[redigido]` (≠ dispose `[PHI removido]`) |
| FE (R2–R5 UI) | `027db02` | 7 new components (assignment · internal-notes · related-cases · resolutions · lineage · redact-dialog · thread-item) + "Minhas atribuições" page + chips/wizard/dashboard/thread updates | tsc 0 · lint 0/0 · `next build` green |

**Fix round (QA r1 CHANGES REQUESTED → fixed + re-proven):**
- **MAJOR `1885159`** — Rule 11 gap: `list_referral_internal_notes` served PHI note bodies with NO read audit. Fixed: PHI-free `referral.note_viewed` via `log_audit_access → app._audit_access_authorized → app.audit_write` (same mechanism as `referral_patient.read`); payload `{referral_id, note_count}`, actor_id=auth.uid(), fires only when ≥1 note served. pgTAP `150_referrals` 217/217, live-proven (source→1 audit row PHI-free; QPS→0 notes→0 audit); K-R5-1 unchanged; new plural predicate `can_read_referral_internal_notes` audit-only (no PQS arm, 0 RLS policies).
- **MINOR `1893cb6`** — send-wizard "Aguardar resposta" checkbox a11y (`htmlFor` + `aria-describedby`).

## Gate
- **Build:** 4 backend increments + FE; lint 0/0, tsc 0, next build green.
- **Test:** governance E2E **29/29** + R1 **40/40** (prod-standalone). Full suite 346 pass / 33 fail — ALL triaged to pre-existing baseline (server-collapse ×24 + GoTrue login rate-limit ×7 + RV2-unrelated patient-index ×1 + nsp AC-7 dispose confirmed-flake via 32/32 isolation). pgTAP `150_referrals` **217/217** on a fresh reset. Tester reconciled the governance spec (`675219c` — 8 spec-vs-reality fixes, no app bugs) + role-scoped locators (`faa7c4d`).
- **QA:** ✅ APPROVED r2, 0 P0/MAJOR/MINOR — `docs/reviews/rv2-r2-r5-review.md`. r1 caught the Rule 11 audit gap; re-proven live.
- **PO:** approved 2026-07-19.

## SQLSTATEs (block `HC0A·`)
`HC0A3` vocab CRUD · `HC0A4` set-deadline · `HC0A5` resolve/reopen state · `HC0A6` parent lineage ·
`HC0A7` assignment · `HC0A8` link · `HC0A9` redaction. **Authority = `42501`, checked FIRST**, distinct
from the state codes (ADR-0078 non-vacuity discipline).

## Follow-ups (non-blocking)
- **189 pgTAP baseline** (`189_nsp_per_hospital_isolation` test 39): stale seed fixture — ENC-0004
  (`efa…a4`) is seed-disposed, but 189 uses it as its dispose target → `HC056`. RV2-UNRELATED (0 RV2
  commits on `seed.sql`/189; the `HC056` guard predates R5; reproduces on `main`). Flagged as a
  separate qa-tester cleanup (spawn_task 2026-07-19).
- **Notes-SSR hardening (INFO):** move the audited notes read out of RSC render into a client Server
  Action (keeps note bodies out of SSR HTML). Works correctly today — defense-in-depth only.
- **Pilot:** `case_referrals` flag enablement + origin push + Coolify deploy + pilot DB reset.

## Lessons (transferable)
- **A "write-during-render crash" hypothesis was DISPROVEN by the FE engineer** (verify-don't-comply):
  Next.js Server Components CAN perform DB writes during render (no crash); the R5 note tests render
  notes + fire the audit fine; the E2E failures were **action→`router.refresh` flakes on note-LESS
  referrals**. Don't assume a render crash comes from a DB write — reproduce first.
- **The full-suite fresh-reset pgTAP is the only gate that surfaces latent failures** (189) that
  targeted per-file runs miss; backend agents that run only affected files won't see them.
- `list_referral_internal_notes` returns a single JSONB array (not SETOF) → `count(*)` over it is
  always 1; use `jsonb_array_length` when asserting note counts.
- A subagent's E2E run dies at turn-end; the **lead owns the full/gate E2E run**. Governance spec is
  `mode: 'serial'` → one early failure cascades and hides the rest; triage the first failure, re-run.
